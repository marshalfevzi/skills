# Run notes — eval 3 with_skill / run-1 (token ws3a-)

## Finding: project-scoped managed networks require OVN on this daemon

Incus 6.0.0, no OVN installed. Empirically:

- `incus project set <p> features.networks=true` succeeds.
- But then `incus network create <net> --project <p>` fails with
  `Error: Failed loading network: OVN isn't currently available`, and
  `incus network list --project <p>` is EMPTY even though `ws3a-br0` exists in
  the default project.

So with `features.networks=true`, a non-OVN daemon gives the project a broken
(empty) view of every managed network — instances could not get a NIC at all.

**Resolution used:** keep `features.networks=false`; create the separate bridge
in the default project (`ws3a-br0`) and reference it from the contractor
project's profile (`eth0: network=ws3a-br0`). Traffic isolation holds: separate
bridge interface, separate subnet (10.100.50.0/24 vs 10.76.67.0/24), and
`used_by` shows only this run's objects.

## Finding: user-created bridges don't NAT out of the box here

`incus network create ws3a-br0 ...` left `ipv4.nat` unset; outbound pings from
the container were dropped until `incus network set ws3a-br0 ipv4.nat=true`.
(The init-created `incusbr0` had NAT preconfigured, which masks this.)

## Note: skill doc wording vs. observed behavior

The skill's administration.md says `features.networks` "needs OVN to enable".
Observed: the flag itself can be SET without OVN; what fails is using managed
networks inside the project afterwards. The flag being true is actively harmful
on a non-OVN daemon. Consider rewording to warn that setting it without OVN
blinds the project to all networks.

## Leftovers

- Project `ws3a-probe`: created during the feasibility probe, contains nothing
  (bridge creation inside it errored before any object existed), features.networks
  was set true on it. Left in place per "clean up nothing"; harmless but can be
  deleted if graders prefer.
- Other runs' instances (ws1a-webapp FROZEN, ws2a-bulk, ws2b-bulk) untouched.
