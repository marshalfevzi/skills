Images are how every instance gets born: this file covers finding images on
remote servers, copying and building them, aliases, remotes/trust, and profiles.
Instance lifecycle and device details live in [instances.md](instances.md).

# Image servers

The CLI ships with one image server preconfigured. See everything configured on
a given host with `incus remote list` — distributions sometimes add their own.

| Remote prefix | Protocol | What it serves |
| --- | --- | --- |
| `images:` (default) | simplestreams | Minimal community images for many distros at [images.linuxcontainers.org](https://images.linuxcontainers.org); container *and* VM variants |
| `local:` | incus | Your daemon's own image store (also the fallback when you type an image name without a prefix) |
| `<name>:` | incus / simplestreams / oci | Any server added with `incus remote add` |

Server kinds behind those prefixes:

| Kind | Traits |
| --- | --- |
| simplestreams | Static files on any HTTPS web server; pure image server. Build one with `incus-simplestreams add|list|remove` plus `generate-metadata` |
| OCI registry | Application container images (Docker Hub etc.). Containers only — never usable as system-container roots or VMs |
| Public Incus server | An Incus server serving only images marked `public`; no auth needed to pull |
| Full Incus server | A regular managed server whose images you may also use |

Reference an image as `<remote>:<alias>` or `<remote>:<fingerprint>`:
`images:debian/12`, `local:ed7509d7e83f`. For an OCI remote the image is
`<registry-remote>:<image>`, e.g. `oci-docker:hello-world` after
`incus remote add oci-docker https://docker.io --protocol=oci`.

## Listing and filtering

```bash
incus image list images:              # everything on a server (big!)
incus image list images: debian       # substring of alias/fingerprint
incus image list images: debian arm64 # several substrings AND together
incus image list images: debian architecture=x86_64   # key=value property filter
```

Inspect before you launch: `incus image info images:debian/12`,
`incus image show <image>` for raw properties, and
`incus image get-property images:debian/12 release` for a single property.
Properties are informational metadata — they steer nothing in the daemon.

# Caching and auto-update

Launching from a remote image downloads it into the local store flagged as
cached, then reuses that copy. Cached images expire after
`images.remote_cache_expiry` days unused (the daemon tracks `last_used_at`) or
on their own expiry date. Auto-update applies only to images addressed by
*alias* — a fingerprint pins an exact version — and runs every
`images.auto_update_interval` (default 6h): the new download replaces the old,
aliases move over, the old image is dropped.

# Copy, import, export

```bash
# Pull a remote image into your local store (or push local -> other server)
incus image copy images:debian/12 local:
incus image copy myimage target-remote:
```

Useful `image copy` flags:

| Flag | Effect |
| --- | --- |
| `--alias <name>` | Name the copy |
| `--copy-aliases` | Bring the source's aliases along |
| `--auto-update` | Keep tracking upstream like a cached image would |
| `--vm` | When addressing by alias, pick the VM build of that alias — same name, different artifact |

Export to files for air-gapped transfer or backup, import them back elsewhere:

```bash
incus image export [<remote>:]<image> [<dir>]          # container image
incus image export [<remote>:]<image> [<dir>] --vm     # VM image
incus image import <file-or-dir> [<target>:]           # unified image
incus image import <metadata.tar.xz> <rootfs> [<target>:]  # split image
incus image import https://example.com/img.tar.xz      # direct URL fetch
```

Unified tarballs (metadata + rootfs in one archive, gzip/xz compressed) are the
normal case — publishing produces them. Split tarballs exist to wrap rootfs
trees built by non-Incus tooling. URL import needs a plain web server that sets
two response headers: `Incus-Image-Hash` (SHA256 of the file) and
`Incus-Image-URL`. Image format details (metadata.yaml fields, optional Pongo2
templates for `/etc/hosts`-style generation): see `reference/image_format` in
the upstream docs — rarely needed day-to-day.

# Building images

Two routes, ordered by effort:

1. **Publish an existing instance** — the everyday route. Stop the instance
   first (or publish a snapshot: `incus publish <inst>/<snap>`):

   ```bash
   incus publish web1 --alias web1-golden --reuse
   ```

   Flags: `--alias`, `--expire`, `--public`, `--reuse` (overwrite same-named
   image). Publishing serializes because it tarballs and compresses the whole
   root filesystem — expect it to be slow and I/O-heavy. Before publishing,
   scrub what should not ship: host SSH keys, `machine-id`, and the instance's
   metadata/templates (`incus config metadata`, `incus config template`).
2. **Build from scratch with [distrobuilder](https://linuxcontainers.org/distrobuilder/docs/latest/)**
   when you need reproducible images not derived from a running guest.

For OCI workloads, rebuild and push a new image to the registry instead of
publishing a mutated OCI container.

Deleting a locally cached image (`incus image delete <image>`) is safe for
running instances — they already have their rootfs — and the next launch just
re-downloads. Deleting a hand-published image loses it permanently.

# Aliases

An alias is a server-side name pointing at one image fingerprint; repointing an
alias is how you roll "latest good build" forward.

```bash
incus image alias list                       # full alias table
incus image alias create stable <fingerprint>
incus image alias rename stable prod
incus image alias delete stable
```

To repoint an alias at a newer image, delete then recreate it — there is no
update-in-place. Assigning an alias at publish/copy/import time (`--alias`)
saves a round-trip.

Distinct concept, same word: **command aliases** are purely client-side
shortcuts stored in the CLI config (`incus alias add ll "list"`, removed with
`incus alias remove`). Arguments land at the end unless the alias uses
`@ARGS@`/`@ARG1@` position markers. The built-in `shell`
(`exec @ARGS@ -- su -l`) gives a root login shell: `incus shell web`. A custom
alias named `shell` masks the built-in until removed. Cloud-image users log in
as the distro user, not root: `incus exec web -- su -l debian` (also `ubuntu`,
`alpine`, `fedora` per image).

# Remotes and trust

```bash
incus remote list                 # all configured remotes
incus remote add my-remote 192.0.2.10        # full Incus server
incus remote add streams https://… --protocol=simplestreams   # image-only
incus remote add docker https://docker.io --protocol=oci     # app images
incus remote rename old new · incus remote set-url … · incus remote remove …
incus remote get-default          # where unprefixed commands go
incus remote switch my-remote     # change that default
```

Adding a full Incus server is the **trust-token flow**, and it needs two sides:

1. On the *server*: expose the API (`core.https_address`, see
   [administration.md](administration.md)) and mint a token:
   `incus config trust add <client-name>`.
2. On the *client*: `incus remote add my-remote <IP|FQDN|URL>`. Confirm the
   displayed server fingerprint, then paste the token when prompted.

Other auth types exist (`--auth-type=oidc`); TLS-with-token is the common one.
Once trusted, the remote behaves like the local daemon — instances, storage,
networks, everything — always reachable as `my-remote:<object>` or via
`--project`/switching defaults.

Prefer fleet-wide remotes over per-user ones? Write `/etc/incus/config.yml`
instead (applies to every user of that machine; users may still override into
their own config):

```yaml
remotes:
  foo:
    addr: https://192.0.2.4:8443
    auth_type: tls
    protocol: incus
    public: false
    project: default
```

Server certificates for such remotes live in `/etc/incus/servercerts/<name>.crt`;
per-remote client certificates go in `/etc/incus/clientcerts/` as
`<name>.crt`+`<name>.key`.

Frequent scripted use of one remote pays a TLS handshake per command; enable
keepalive to hold the connection open:

```bash
incus remote set-keepalive my-remote 30   # seconds; 0 disables
incus remote add my-remote 192.0.2.10 --keepalive 30
```

# Profiles

A profile bundles config keys and devices for reuse across instances. Layering
order, most specific wins:

1. The image's own profile list (usually just `default`; override at launch
   with `--profile a --profile b` or opt out entirely with `--no-profiles`).
2. Profiles apply in listed order — for any single key, the **last** profile
   that sets it takes precedence.
3. Instance-local configuration beats all profile values.

The `default` profile supplies `eth0` on `incusbr0` and a root disk on the
`default` pool — which is why a bare `incus launch` just works. It cannot be
renamed or removed. Profiles may mix container-only and VM-only settings;
inapplicable entries are silently ignored rather than erroring, so verify with
`incus config show <inst> --expanded` rather than assuming the merge did what
you pictured.

```bash
incus profile list · incus profile show <profile>
incus profile create web-base
incus profile set web-base limits.memory=512MiB security.privileged=false
incus profile device add web-base http proxy listen=tcp:0.0.0.0:8080 connect=tcp:127.0.0.1:80
incus profile edit web-base            # full YAML, or: incus profile edit p < profile.yaml
incus profile add web1 web-base        # attach to a running instance
incus profile remove web1 web-base     # detach
```

Editing a profile changes every attached instance immediately — convenient for
fleet-wide fixes, and exactly why you read `profile show` (check `used_by`)
before editing something shared. Device option tables live in
[instances.md](instances.md); NIC and bridge specifics in
[networking.md](networking.md); root-disk pools in [storage.md](storage.md).

An image can also carry its own profile list: `incus image edit <image>` and
set the `profiles:` section. Note the trap: an empty list means truly no
profiles, while removing the key means `default`.

# Client-side configuration

All client state sits in `$HOME/.config/incus/config.yml` (redirect with
`INCUS_CONF`): remotes, `default-remote`, command aliases, output defaults.
Edit it through `incus remote`/`incus alias` commands rather than by hand —
hand edits can desync certificate state. Environment overrides worth knowing:
`INCUS_REMOTE` picks the default remote, `INCUS_PROJECT` the default project,
both beaten only by explicit `<remote>:` prefixes and `--project` flags.
