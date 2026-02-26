process.env.NEXT_TELEMETRY_DISABLED = "1";
process.chdir(__dirname);
require("next/dist/bin/next");
