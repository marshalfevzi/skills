# User notes — run ws2b (eval 2, without_skill)

- First `incus storage volume attach` without a path failed: "Custom filesystem volumes require a path to be defined". Retried with `/mnt/extras` and it succeeded.
- The pool uses the `dir` driver, so the volume's `size=1GiB` is recorded in its config but is not enforced as a hard quota (`df` inside the container shows the underlying filesystem size). A quota-enforcing driver would be needed for a true 1 GiB cap.
