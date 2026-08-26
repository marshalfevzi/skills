---
name: incus-lxc
description: >-
  Operate Incus, the modern system container and VM manager (LXD/LXC successor):
  launch, configure, exec into, snapshot, back up, and delete instances; manage
  images, remotes, profiles, storage pools/volumes, networks (bridges, port
  forwards, ACLs), projects, and server configuration. Use whenever the user
  mentions incus, lxc, lxd, system containers, lightweight VMs, container/VM
  images, profiles, storage pools, bridges or port forwarding on a Linux host,
  or asks to deploy a service into a container/VM — even if they never say "Incus".
version: 1.0.0
category: infrastructure
---

# Incus operations

Incus manages system containers and virtual machines on a Linux host. This skill
gets you from "no idea where the daemon is" to operating instances confidently,
and routes deeper questions into five reference files under `references/`.

## What Incus is

Incus is image-based: you launch an instance from an image, then configure and
use it. Containers share the host kernel and start in seconds; VMs (`--vm`)
boot their own kernel and behave like full machines. Both are *instances* driven
by the same commands. Instance configuration is `key=value` pairs such as
`limits.cpu=1` and `limits.memory=512MiB`.

## Reach the daemon first

The `incus` CLI is a client for a Linux daemon, and you may be on macOS, in a
sandbox, or on the host itself. Determine your execution path before running any
other command, in this order:

1. **Local binary**: `command -v incus`. If found, run `incus list`. An instance
   table (possibly empty) proves a reachable daemon — use plain `incus …`.
2. **OrbStack Linux machine**: no local `incus`, but `command -v orbctl` finds a
   binary and `orbctl list` shows a Linux machine. Wrap every command:
   `orb -m <machine> incus …`. If the machine has no Incus yet:
   ```bash
   orb -m <machine> sudo apt-get update && orb -m <machine> sudo apt-get install -y incus
   orb -m <machine> sudo incus admin init --minimal
   orb -m <machine> sudo adduser "$(whoami)" incus-admin
   ```
   Each `orb -m` call starts a fresh login shell, so group membership applies on
   the next invocation. Verify with `orb -m <machine> incus list`.
3. **Remote server**: neither of the above, but the user names a server. Install
   the client alone — `brew install incus` on macOS ships the client without a
   daemon — then attach:
   ```bash
   incus remote add <name> <host[:port]>
   ```
   The server side must expose its API (`core.https_address`) and mint a trust
   token with `incus config trust add <client-name>`; supply that token when the
   client prompts. Address every object explicitly with `--remote <name>`, or
   switch once with `incus remote switch <name>` and drop the flag.

None of these apply → report what is missing instead of improvising: the Incus
daemon exists only on Linux.

## Command grammar

Everything else builds on these verbs. `<inst>` means an instance name, with an
optional `:<remote>` or `<remote>:<inst>` prefix.

| Task | Command |
| --- | --- |
| Create and start, with limits | `incus launch images:debian/12 web --config limits.cpu=1 --config limits.memory=512MiB` |
| Create without starting; make it a VM | `incus init images:ubuntu/24.04 db --vm` |
| Lifecycle | `incus start \| stop \| restart <inst>` |
| Remove | `incus delete <inst>` — refuses running instances; see the gate below |
| Clone / relocate | `incus copy src dst`, `incus move old new` |
| Run a command inside | `incus exec web -- apt-get install -y nginx` |
| Move files | `incus file push app.conf web/etc/app.conf` · `incus file pull web/var/log/nginx/error.log -` |
| Change configuration | `incus config set web limits.memory=1GiB` · `incus config show web` · `config edit` |
| Add/override devices | `incus config device add web http proxy listen=tcp:0.0.0.0:8080 connect=tcp:127.0.0.1:80` · `config device override` for profile-inherited devices |
| Snapshots | `incus snapshot create web clean` · `snapshot restore web clean` · `snapshot delete …` |
| Inspect | `incus list` · `incus info web` · `incus info web --show-log` |

Object namespaces follow the same shape: `incus config`, `profile`, `network`,
`storage`, `image`, `project`, `remote`, `admin`. Image specifiers name a server.
A stock install ships two: `images:debian/12` (public linuxcontainers.org
images, including `images:ubuntu/24.04`) and bare names for the local store.
Servers you add as remotes contribute their own prefix; see
[references/images-profiles.md](references/images-profiles.md).

This table is syntax only. The recipes, flags that matter, and failure modes
live in the references — route by task:

| When the task touches… | Read |
| --- | --- |
| Creating, limiting, configuring instances; cloud-init; devices; exec/file workflows; console; troubleshooting; snapshots & backups | [references/instances.md](references/instances.md) |
| Finding, copying, building images; aliases; remotes; profiles & inheritance; client TLS | [references/images-profiles.md](references/images-profiles.md) |
| Storage pools, custom volumes, attaching disks, moving or exporting volumes | [references/storage.md](references/storage.md) |
| Bridges, NIC types, port forwards, ACLs, DNS/firewall interplay, OVN | [references/networking.md](references/networking.md) |
| Server init & tuning, API exposure, projects, clustering, debugging, metrics, authn/z | [references/administration.md](references/administration.md) |

Each reference opens with a two-line scope statement; if a request falls between
two files, the scope lines tell you which owns it.

## Judgment calls that bite

- **`--vm` changes the download.** The same image name resolves to a different
  VM-compatible build; a container-only image fails to boot as a VM.
- **Stop before delete when the data matters.** `delete` on a running instance
  errors out; `--force` bypasses that check, but stopping first lets the guest
  flush its filesystems, which a forced kill does not guarantee.
- **`exec` needs the `--` separator.** Without it, flags meant for the inner
  command get eaten by `incus` itself: `incus exec web -- ls -la /`.
- **Wrappers eat quoting levels.** Through `ssh host incus exec web -- …` or
  `orb -m m incus exec …`, each layer strips one round of quotes; test the inner
  command with `echo` before running something destructive.
- **Commands are project-scoped.** Most commands act inside the current project;
  pass `--project <name>` explicitly whenever more than the default project
  exists, or you will silently operate on the wrong namespace.
- **Device support differs by instance type.** Some device kinds work only on
  containers or only on VMs; check the device tables in
  [references/instances.md](references/instances.md) before promising a device
  will attach.

## Destructive-action gate

Deletions in Incus are immediate — there is no undo and no recycle bin, because
the daemon frees storage and state at once. Pause and confirm with the human
before any of these:

- deleting instances, snapshots, volumes, pools, profiles, networks, projects,
  images, or cluster members
- any `delete --force`, or removing a running instance's last snapshot
- recovery operations (`incus admin recover`) that rewrite daemon state

Offer the reversible alternative where one exists: `stop` instead of force-delete,
`export` a volume backup before removing a pool. When the user has clearly asked
for the deletion, proceed without re-litigating.
