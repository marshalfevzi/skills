# Run transcript — eval 1 (deploy-web-with-profile) / without_skill / run-1

- Collision token: `ws1b-` → requested `webapp` becomes instance **ws1b-webapp**.
- Entry point: every command via `orb -m incus-test <cmd>`.
- Incus version: 6.0.0

## Step 0 — daemon reachable
```
$ orb -m incus-test incus list
+-----------+---------+---------------------+-----------------------------------------------+-----------+-----------+
|   NAME    |  STATE  |        IPV4         |                     IPV6                      |   TYPE    | SNAPSHOTS |
| ws2a-bulk | RUNNING | 10.76.67.130 (eth0) | fd42:fd97:968e:698c:216:3eff:fea5:c17a (eth0) | CONTAINER | 0         |
| ws2b-bulk | RUNNING | 10.76.67.18 (eth0)  | fd42:fd97:968e:698c:216:3eff:fed8:4282 (eth0) | CONTAINER | 0         |
```

## Step 1 — port check
```
$ ss -ltn | grep :8080 || echo PORT_8080_FREE
PORT_8080_FREE        (curl already present at /usr/bin/curl)
```

## Step 2 — launch container
```
$ incus launch images:ubuntu/24.04 ws1b-webapp -c limits.cpu=1 -c limits.memory=512MiB
(first attempt `ubuntu:24.04` failed: Error: The remote "ubuntu" doesn't exist — no ubuntu remote configured)
Launching ws1b-webapp
Retrieving image: Unpack: 100% (4.41GB/s)
```
Verified RUNNING, IPv4 10.76.67.62; `limits.cpu` → `1`, `limits.memory` → `512MiB`.

## Step 3 — install nginx
```
$ incus exec ws1b-webapp -- sh -c 'apt-get update && apt-get install -y nginx'
NGINX_INSTALLED
```

## Step 4 — serve hello page inside container
```
$ incus exec ws1b-webapp -- sh -c 'echo "hello from incus" > /var/www/html/index.nginx-debian.html && systemctl reload nginx; curl -sf http://127.0.0.1:80/'
hello from incus
```

## Step 5 — expose port 8080 to VM host
```
$ incus config device add ws1b-webapp port8080 proxy listen=tcp:0.0.0.0:8080 connect=tcp:127.0.0.1:80
Device port8080 added to ws1b-webapp
```

## Step 6 — HTTP request from the VM host (decisive check)
```
$ orb -m incus-test curl -sf http://localhost:8080/
hello from incus
```

## Step 7 — snapshot `clean`
```
$ incus snapshot create ws1b-webapp clean && incus info ws1b-webapp
Snapshots:
| NAME  |       TAKEN AT       | EXPIRES AT | STATEFUL |
| clean | 2026/08/26 16:10 +03 |            | NO       |
```

## Final state verification
All acceptance criteria met; resources left RUNNING and in place.
