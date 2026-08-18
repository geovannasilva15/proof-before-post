import os from "node:os";

// Some CI sandboxes deny the system call Next uses only to print LAN addresses.
// E2E runs on loopback, so expose loopback without changing the application server.
os.networkInterfaces = () => ({
  lo: [{ address: "127.0.0.1", netmask: "255.0.0.0", family: "IPv4", mac: "00:00:00:00:00:00", internal: true, cidr: "127.0.0.1/8" }],
});

process.argv.splice(2);
process.argv.push("start", "--hostname", "127.0.0.1", "--port", "3000");
await import("next/dist/bin/next");
