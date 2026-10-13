#!/usr/bin/env python3
"""Owner-run signing setup. Never run this helper in CI or send its key to chat."""

import argparse
import base64
import getpass
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
from datetime import datetime, timezone


REPOSITORY = "JustPixelll/pocket-lab"
KEY_ALIAS = "pocket-korean-personal"
KEY_FILE = "pocket-korean-personal.jks"
IDENTITY_FILE = "signing-identity.json"
FINGERPRINT_VARIABLE = "POCKET_SIGNING_CERT_SHA256"
SECRET_NAMES = (
    "POCKET_KEYSTORE_BASE64", "POCKET_KEYSTORE_PASSWORD",
    "POCKET_KEY_ALIAS", "POCKET_KEY_PASSWORD",
)
REPOSITORY_ROOT = Path(__file__).resolve().parents[1]


class SetupError(Exception):
    pass


def run(command, *, purpose, child_env, input_bytes=None, allow_missing=False):
    """No shell, credential arguments, debug output, or raw command output."""
    try:
        result = subprocess.run(command, input=input_bytes, capture_output=True,
                                env=child_env, timeout=60, check=False)
    except (OSError, subprocess.TimeoutExpired) as error:
        raise SetupError(f"Could not {purpose}. Retain any backup files. Use --resume only if signing-identity.json exists; otherwise inspect the failure using docs/personal-updates.md.") from error
    if result.returncode:
        if allow_missing and b"HTTP 404" in result.stderr:
            return None
        raise SetupError(f"Could not {purpose} (exit {result.returncode}). Check GitHub permissions or the keystore password. Retain any backup files; --resume requires signing-identity.json. See docs/personal-updates.md if it is missing.")
    return result.stdout


def gh(arguments, *, purpose, child_env, input_bytes=None, allow_missing=False):
    return run(["gh", *arguments], purpose=purpose, child_env=child_env,
               input_bytes=input_bytes, allow_missing=allow_missing)


def secret_names(child_env):
    output = gh(["secret", "list", "--repo", REPOSITORY, "--app", "actions", "--json", "name"],
                purpose="list repository secret names", child_env=child_env)
    return {item["name"] for item in json.loads(output)}


def registered_fingerprint(child_env):
    output = gh(["api", f"repos/{REPOSITORY}/actions/variables/{FINGERPRINT_VARIABLE}"],
                purpose="read the public signing fingerprint", child_env=child_env, allow_missing=True)
    if output is None:
        return None
    value = str(json.loads(output).get("value", "")).strip().lower()
    if not re.fullmatch(r"[0-9a-f]{64}", value):
        raise SetupError("The registered public signing fingerprint is invalid. Inspect it without replacing the signing key.")
    return value


def private_write(path, data):
    # The parent directory is private and files are never overwritten.
    with path.open("xb") as output:
        output.write(data)
    if os.name == "posix":
        path.chmod(0o600)


def main():
    parser = argparse.ArgumentParser(description=(
        "Create Pocket Korean's permanent signing identity outside the checkout, "
        "then upload its four encrypted Actions secrets using your own GitHub CLI login. "
        "No app build is started."))
    parser.add_argument("--backup-dir", required=True, type=Path,
                        help="new private backup directory outside this repository")
    parser.add_argument("--resume", action="store_true",
                        help="resume with the same existing backup; never generate a replacement key")
    args = parser.parse_args()
    if not sys.stdin.isatty():
        raise SetupError("Run this helper in your own interactive terminal so the password is entered without echo.")
    for tool in ("keytool", "gh"):
        if not shutil.which(tool):
            raise SetupError(f"Install {tool} first. See docs/personal-updates.md.")
    backup = args.backup_dir.expanduser().resolve()
    if backup == REPOSITORY_ROOT or REPOSITORY_ROOT in backup.parents:
        raise SetupError("The private signing backup must be outside the repository, including ignored folders.")
    if backup == Path.home().resolve() or backup == Path(backup.anchor):
        raise SetupError("Choose a new dedicated backup directory, not your home directory or a drive root.")
    if os.name == "posix":
        os.umask(0o077)
    child_env = dict(os.environ)
    child_env.pop("GH_DEBUG", None)
    child_env.pop("DEBUG", None)
    child_env["GH_PROMPT_DISABLED"] = "1"
    login = gh(["api", "user", "--jq", ".login"], purpose="identify the GitHub account",
               child_env=child_env).decode("utf-8").strip()
    if login.casefold() != REPOSITORY.split("/")[0].casefold():
        raise SetupError(f"Sign GitHub CLI into the owner account for {REPOSITORY} before continuing.")
    repo = json.loads(gh(["repo", "view", REPOSITORY, "--json", "nameWithOwner,viewerPermission"],
                         purpose="check repository access", child_env=child_env))
    if repo.get("nameWithOwner", "").casefold() != REPOSITORY.casefold() or repo.get("viewerPermission") != "ADMIN":
        raise SetupError("The owner account needs repository administration access for this one-time setup.")
    existing_names = secret_names(child_env).intersection(SECRET_NAMES)
    pinned = registered_fingerprint(child_env)
    if existing_names == set(SECRET_NAMES) and pinned and not args.resume:
        print("Signing settings already exist. No key or settings were changed.")
        print("Their values are not readable through this helper; verify the next release's public fingerprint.")
        return
    if (existing_names or pinned) and not args.resume:
        raise SetupError("Signing settings already exist or setup is partial. Use --resume with the original backup; do not generate another key.")
    if args.resume and existing_names and not pinned:
        raise SetupError("Existing secrets have no registered identity. Do not overwrite them; inspect the original owner setup first.")

    key_path = backup / KEY_FILE
    identity_path = backup / IDENTITY_FILE
    identity = None
    if args.resume:
        if not key_path.is_file() or not identity_path.is_file():
            raise SetupError("Resume requires this helper's original keystore and signing-identity.json in the backup directory.")
        identity = json.loads(identity_path.read_text(encoding="utf-8"))
        if identity.get("repository") != REPOSITORY or identity.get("alias") != KEY_ALIAS:
            raise SetupError("This backup belongs to a different signing setup.")
    elif backup.exists():
        raise SetupError("The backup directory already exists. Choose a new dedicated directory, or --resume the original setup.")

    print(f"Repository: {REPOSITORY}")
    print(f"Private owner backup: {backup}")
    print("The password is never printed or saved by this helper. Keep it in your password manager.")
    password = getpass.getpass("Keystore password (at least 12 characters): ")
    if len(password) < 12:
        raise SetupError("Use a password of at least 12 characters.")
    if not args.resume and password != getpass.getpass("Confirm keystore password: "):
        raise SetupError("The passwords do not match. Nothing was created.")
    key_env = dict(child_env)
    key_env["POCKET_SETUP_PASSWORD"] = password
    if not args.resume:
        backup.mkdir(mode=0o700, parents=True, exist_ok=False)
        run(["keytool", "-genkeypair", "-storetype", "JKS", "-keystore", str(key_path),
             "-alias", KEY_ALIAS, "-keyalg", "RSA", "-keysize", "3072", "-validity", "10000",
             "-dname", "CN=Pocket Korean Personal", "-storepass:env", "POCKET_SETUP_PASSWORD",
             "-keypass:env", "POCKET_SETUP_PASSWORD"],
            purpose="create the owner signing key", child_env=key_env)
        if os.name == "posix":
            key_path.chmod(0o600)
    certificate = run(["keytool", "-exportcert", "-storetype", "JKS", "-keystore", str(key_path),
                       "-alias", KEY_ALIAS, "-storepass:env", "POCKET_SETUP_PASSWORD"],
                      purpose="verify the owner's signing certificate", child_env=key_env)
    fingerprint = hashlib.sha256(certificate).hexdigest()
    if identity and identity.get("certificateSHA256") != fingerprint:
        raise SetupError("The keystore differs from its recorded identity. No GitHub settings were changed.")
    if pinned and pinned != fingerprint:
        raise SetupError("This key differs from GitHub's registered identity. No GitHub settings were changed.")
    if not args.resume:
        identity = {"repository": REPOSITORY, "packageName": "net.pocketlab.korean", "alias": KEY_ALIAS,
                    "keystoreFile": KEY_FILE, "certificateSHA256": fingerprint,
                    "createdAt": datetime.now(timezone.utc).isoformat()}
        private_write(identity_path, (json.dumps(identity, indent=2) + "\n").encode("utf-8"))
        private_write(backup / "signing-certificate.der", certificate)
        private_write(backup / "BACKUP-README.txt", (
            f"Pocket Korean signing backup for {REPOSITORY}\n\n"
            f"Keep {KEY_FILE} and signing-identity.json in durable private storage.\n"
            "Keep the password separately in your password manager; both key and store use that password.\n"
            "A Codespace or temporary computer is not your only backup. Copy these files somewhere you control.\n"
            "Never commit, attach to a release, paste into chat, or post the keystore or its Base64 text.\n"
            f"The public certificate SHA-256 is {fingerprint}.\n"
            "If setup was interrupted, run the helper with this directory and --resume.\n"
        ).encode("utf-8"))
    encoded_key = base64.b64encode(key_path.read_bytes())
    if len(encoded_key) > 48 * 1024:
        raise SetupError("This keystore is too large for the configured GitHub secret. The owner backup remains saved.")
    print(f"Public certificate SHA-256: {fingerprint}")
    print("Before uploading: save the password in your password manager and copy the backup directory to durable private storage.")
    print("In a Codespace, download the backup outside the Codespace before continuing.")
    if input("Type BACKED UP when your independent backup is saved: ").strip() != "BACKED UP":
        raise SetupError("Stopped before uploading settings. Your key stays in the backup directory; resume with the same directory.")

    # Register the public identity first so interrupted uploads can only resume
    # with the same backed-up key. GitHub's separate secret writes are not atomic.
    if pinned is None:
        gh(["variable", "set", FINGERPRINT_VARIABLE, "--repo", REPOSITORY, "--body", fingerprint],
           purpose="register the public certificate fingerprint", child_env=child_env)
    values = (encoded_key, password.encode("utf-8"), KEY_ALIAS.encode("utf-8"), password.encode("utf-8"))
    for name, value in zip(SECRET_NAMES, values):
        gh(["secret", "set", name, "--repo", REPOSITORY, "--app", "actions"],
           purpose=f"upload {name}", child_env=child_env, input_bytes=value)
        print(f"Configured {name}.")
    if secret_names(child_env).intersection(SECRET_NAMES) != set(SECRET_NAMES) or registered_fingerprint(child_env) != fingerprint:
        raise SetupError("Signing metadata verification was incomplete. Resume with the same owner backup.")
    print("Signing setup is configured. No app build was started.")
    print("Run Build Pocket Korean on main in GitHub Actions to create the first personal release.")
    print("Keep this backup and its password: losing the signing key prevents future in-place updates.")


if __name__ == "__main__":
    try:
        main()
    except (SetupError, ValueError, OSError) as error:
        print(f"Setup stopped: {error}", file=sys.stderr)
        sys.exit(1)
    except (KeyboardInterrupt, EOFError):
        print("Setup cancelled. Retain any files already created. Resume with the same backup only if signing-identity.json exists; otherwise inspect the interrupted setup using docs/personal-updates.md.", file=sys.stderr)
        sys.exit(130)
