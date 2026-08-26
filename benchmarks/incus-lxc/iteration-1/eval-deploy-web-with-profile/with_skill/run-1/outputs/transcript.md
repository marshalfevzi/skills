# Run transcript — eval 1 `deploy-web-with-profile`, WITH skill (run-1)

- Token: `ws1a-` (prefixes every created name)
- Name mapping: requested `webapp` → instance `ws1a-webapp`; requested snapshot `clean` → `ws1a-clean`
- Skill followed: skills/incus-lxc/SKILL.md (+ references/instances.md, references/networking.md)
- Started: 2026-08-26T13:00:50Z · Finished: 2026-08-26T13:04:30Z
- No uncertainties encountered → no user_notes.md written

## Step 0 — Reach the daemon (SKILL.md §Reach the daemon first)

No local `incus` on macOS; OrbStack machine `incus-test` exists → execution path is
`orb -m incus-test <cmd>` for everything.

```
$ command -v incus            → NO_LOCAL_INCUS
$ orbctl list | grep incus-test
  incus-test  running  ubuntu  noble  arm64  1.6 GB  192.168.139.162
$ orb -m incus-test incus list   → exit 0, instance table shown (sibling run's ws2b-bulk visible)
```

## Step 1 — Launch Ubuntu container with limits at create time

Per references/instances.md: limits passed as `--config` flags at launch so they are
effective from first boot.

```
$ orb -m incus-test incus launch images:ubuntu/24.04 ws1a-webapp \
    --config limits.cpu=1 --config limits.memory=512MiB
  Launching ws1a-webapp … Retrieving image: Unpack: 100%
$ orb -m incus-test incus list ws1a-webapp
  | ws1a-webapp | RUNNING | 10.76.67.172 (eth0) | … | CONTAINER | 0 |
```

## Step 2 — Install nginx inside

Per instances.md §Run commands: exec with `--` separator. Quoting kept to one shell
layer (`sh -c "…"` survives the single orb hop).

```
$ orb -m incus-test incus exec ws1a-webapp -- sh -c \
    "apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq nginx"
  Setting up nginx-common (1.24.0-2ubuntu7.17) ...
  Created symlink /etc/systemd/system/multi-user.target.wants/nginx.service
  Setting up nginx (1.24.0-2ubuntu7.17) ... done.
```

## Step 3 — Serve 'hello from incus'

Page written via `incus file push` (instances.md file workflow — avoids the extra
orb quoting layer the skill warns about). Source page kept in outputs/index.html.

```
$ orb -m incus-test incus file push <outputs>/index.html ws1a-webapp/var/www/html/index.html
  Pushing … 100% (272.00MB/s)
$ orb -m incus-test incus exec ws1a-webapp -- curl -sf http://127.0.0.1:80/
  <!doctype html>
  <html><body><h1>hello from incus</h1></body></html>
```

## Step 4 — Expose on host port 8080

Per SKILL.md grammar table / instances.md device table: `proxy` device,
containers support all proxy modes. Checked port free first (shared VM):

```
$ orb -m incus-test ss -ltn | grep ':8080|:80 '   → PORTS_FREE
$ orb -m incus-test incus config device add ws1a-webapp http proxy \
    listen=tcp:0.0.0.0:8080 connect=tcp:127.0.0.1:80
  Device http added to ws1a-webapp
```

## Step 5 — REAL HTTP check from the VM host

```
$ orb -m incus-test curl -sf http://localhost:8080
  <!doctype html>
  <html><body><h1>hello from incus</h1></body></html>
$ orb -m incus-test curl -s -o /dev/null -w 'HTTP %{http_code}\n' http://localhost:8080
  HTTP 200
```

## Step 6 — Verify caps + snapshot `clean`

```
$ orb -m incus-test incus config get ws1a-webapp limits.cpu     → 1
$ orb -m incus-test incus config get ws1a-webapp limits.memory  → 512MiB
$ orb -m incus-test incus snapshot create ws1a-webapp ws1a-clean && incus info ws1a-webapp
  Snapshots:
  | ws1a-clean | 2026/08/26 16:04 +03 |  | NO |
```

## Final end-state (13:04:30Z)

```
$ orb -m incus-test incus list ws1a-webapp
  | ws1a-webapp | RUNNING | 10.76.67.172 (eth0) | fd42:fd97:968e:698c:216:3eff:fe9e:db6f (eth0) | CONTAINER | 1 |
$ orb -m incus-test incus config show ws1a-webapp   (devices section)
    http:
      connect: tcp:127.0.0.1:80
      listen: tcp:0.0.0.0:8080
      type: proxy
$ orb -m incus-test curl -sf http://localhost:8080
  <!doctype html><html><body><h1>hello from incus</h1></body></html>
```

All acceptance criteria met: instance RUNNING with limits.cpu=1 / limits.memory=512MiB,
nginx serving 'hello from incus' on host port 8080 (verified by real HTTP request from
the VM host), snapshot `ws1a-clean` present. Everything left RUNNING and in place.
