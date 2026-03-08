#!/usr/bin/env node

/**
 * ChainLog CLI — verify and inspect on-chain agent audit trails.
 *
 * Commands:
 *   verify  — Verify a local action hash against the on-chain record
 *   inspect — Inspect a specific on-chain action record
 *   count   — Get the number of logged actions for an agent
 *   hash    — Hash a local JSON file or string for comparison
 *   stats   — Show global contract statistics
 */

import { Command } from "commander";
import chalk from "chalk";
import { readFileSync } from "fs";
import {
  getContract,
  getRpcUrl,
  verifyAction,
  getRecordCount,
  getRecord,
  getTotalActions,
} from "./contract.js";
import { hashData, hashLogEntry } from "./hasher.js";

const program = new Command();

program
  .name("chainlog")
  .description("Verify and inspect on-chain AI agent audit trails")
  .version("0.1.0")
  .requiredOption(
    "-c, --contract <address>",
    "ChainLog contract address",
    process.env.CHAINLOG_CONTRACT_ADDRESS
  )
  .option(
    "-n, --network <network>",
    "Network (sepolia or mainnet)",
    "sepolia"
  )
  .option("-r, --rpc <url>", "Custom RPC URL");

program
  .command("verify")
  .description("Verify a local action hash against the on-chain record")
  .requiredOption("-a, --agent <id>", "Agent ID")
  .requiredOption("-i, --index <number>", "Record index", parseInt)
  .requiredOption("-h, --hash <hex>", "Claimed action hash (0x-prefixed)")
  .action(async (opts) => {
    const globalOpts = program.opts();
    const contract = getContract(
      globalOpts.contract,
      globalOpts.rpc ?? getRpcUrl(globalOpts.network)
    );

    try {
      const valid = await verifyAction(
        contract,
        opts.agent,
        opts.index,
        opts.hash
      );

      if (valid) {
        console.log(
          chalk.green("VERIFIED") +
            ` — Action #${opts.index} for agent "${opts.agent}" matches on-chain record`
        );
      } else {
        console.log(
          chalk.red("MISMATCH") +
            ` — Action #${opts.index} for agent "${opts.agent}" does NOT match on-chain record`
        );
        process.exitCode = 1;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(chalk.red("Error:"), msg);
      process.exitCode = 1;
    }
  });

program
  .command("inspect")
  .description("Inspect a specific on-chain action record")
  .requiredOption("-a, --agent <id>", "Agent ID")
  .requiredOption("-i, --index <number>", "Record index", parseInt)
  .action(async (opts) => {
    const globalOpts = program.opts();
    const contract = getContract(
      globalOpts.contract,
      globalOpts.rpc ?? getRpcUrl(globalOpts.network)
    );

    try {
      const record = await getRecord(contract, opts.agent, opts.index);
      console.log(chalk.bold(`Action #${opts.index} for "${opts.agent}":`));
      console.log(`  Hash:        ${record.actionHash}`);
      console.log(`  Metadata:    ${record.metadataURI || "(none)"}`);
      console.log(
        `  Timestamp:   ${new Date(record.timestamp * 1000).toISOString()}`
      );
      console.log(`  Submitter:   ${record.submitter}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(chalk.red("Error:"), msg);
      process.exitCode = 1;
    }
  });

program
  .command("count")
  .description("Get the number of logged actions for an agent")
  .requiredOption("-a, --agent <id>", "Agent ID")
  .action(async (opts) => {
    const globalOpts = program.opts();
    const contract = getContract(
      globalOpts.contract,
      globalOpts.rpc ?? getRpcUrl(globalOpts.network)
    );

    try {
      const count = await getRecordCount(contract, opts.agent);
      console.log(
        `Agent "${opts.agent}" has ${chalk.bold(count.toString())} on-chain records`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(chalk.red("Error:"), msg);
      process.exitCode = 1;
    }
  });

program
  .command("stats")
  .description("Show global contract statistics")
  .action(async () => {
    const globalOpts = program.opts();
    const contract = getContract(
      globalOpts.contract,
      globalOpts.rpc ?? getRpcUrl(globalOpts.network)
    );

    try {
      const total = await getTotalActions(contract);
      console.log(chalk.bold("ChainLog Contract Stats:"));
      console.log(`  Contract:      ${globalOpts.contract}`);
      console.log(`  Network:       ${globalOpts.network}`);
      console.log(`  Total Actions: ${chalk.bold(total.toString())}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(chalk.red("Error:"), msg);
      process.exitCode = 1;
    }
  });

program
  .command("hash")
  .description("Hash a local JSON file or action record for comparison")
  .option("-f, --file <path>", "Path to JSON file")
  .option("-d, --data <json>", "Inline JSON string")
  .option(
    "--action-record",
    "Treat input as ActionRecord (ABI-encoded hash)"
  )
  .action((opts) => {
    try {
      let data: unknown;
      if (opts.file) {
        data = JSON.parse(readFileSync(opts.file, "utf-8"));
      } else if (opts.data) {
        data = JSON.parse(opts.data);
      } else {
        console.error(chalk.red("Provide --file or --data"));
        process.exitCode = 1;
        return;
      }

      let hash: string;
      if (opts.actionRecord) {
        hash = hashLogEntry(data as Parameters<typeof hashLogEntry>[0]);
      } else {
        hash = hashData(data);
      }

      console.log(hash);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(chalk.red("Error:"), msg);
      process.exitCode = 1;
    }
  });

program.parse();
