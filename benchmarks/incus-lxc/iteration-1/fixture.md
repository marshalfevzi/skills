# Incus test fixture

- Machine: OrbStack Linux machine `incus-test` (ubuntu noble 24.04, arm64), created from `orbctl create ubuntu:24.04 incus-test`.
- Entry point: every command runs as `orb -m incus-test <cmd>` (fresh login shell each invocation).
- Incus version: 6.0.0 (Ubuntu native package `6.0.0-1ubuntu0.3`, containers only — no qemu).
- Access: default user `marshal`, member of `incus-admin`; passwordless sudo verified (`sudo -n true`).
- Daemon: initialized with `sudo incus admin init --minimal`; `incus list` empty table confirmed.
- Smoke check passed: `launch images:debian/12 smoke` → `exec smoke -- echo ok` → `delete smoke --force`.
- Storage: single `dir` pool named `default` (from `--minimal`); ZFS/Btrfs unverified inside OrbStack.
- Concurrency model: all benchmark runs share this one daemon; every run namespaces created objects with its collision token prefix.
