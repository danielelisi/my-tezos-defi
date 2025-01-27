<script lang="ts">
  import { afterUpdate } from "svelte";
  import store from "../store";
  import type { Operation } from "../types";
  import { createNewOpEntry } from "../utils";
  import LastOperations from "../lib/LastOperations/LastOperations.svelte";

  let lastTransactions: Operation[] = [];
  let daysInThePast = 7;

  afterUpdate(async () => {
    if (lastTransactions.length === 0 && $store.userAddress) {
      const addresses = [
        ...Object.values($store.tokens).map(
          token => token.address[$store.network]
        ),
        ...Object.values($store.investments).map(
          entry => entry.address[$store.network]
        )
      ];

      let unprocessedTxs = [];
      const headResponse = await fetch("https://api.mainnet.tzkt.io/v1/head");
      if (headResponse) {
        const head = await headResponse.json();
        const currentLevel = head.level;
        // fetches transactions where user was the sender
        const senderLastTxsResponse = await fetch(
          `https://api.mainnet.tzkt.io/v1/operations/transactions?sender=${
            $store.userAddress
          }&target.in=${addresses.join(",")}&level.ge=${
            currentLevel - 60 * 24 * 3
          }&sort.desc=id`
        );
        if (senderLastTxsResponse) {
          const senderLastTxs = await senderLastTxsResponse.json();
          unprocessedTxs = [...senderLastTxs];
        }
        // fetches transactions where user was the target
        const targetLastTxsResponse = await fetch(
          `https://api.mainnet.tzkt.io/v1/operations/transactions?target=${
            $store.userAddress
          }&sender.in=${addresses.join(",")}&level.ge=${
            currentLevel - 60 * 24 * daysInThePast
          }&sort.desc=id`
        );
        if (targetLastTxsResponse) {
          const targetLastTxs = await targetLastTxsResponse.json();
          unprocessedTxs = [...unprocessedTxs, ...targetLastTxs];
        }
        // fetches transactions of fa1.2 tokens
        const fa12TransactionsResponse = await fetch(
          `https://api.mainnet.tzkt.io/v1/operations/transactions?target.in=${addresses.join(
            ","
          )}&entrypoint=transfer&parameter.in=[{"from":"${
            $store.userAddress
          }"},{"to":"${$store.userAddress}"}]&level.ge=${
            currentLevel - 60 * 24 * daysInThePast
          }&limit=200`
        );
        if (fa12TransactionsResponse) {
          const fa12Transactions = await fa12TransactionsResponse.json();
          unprocessedTxs = [...unprocessedTxs, ...fa12Transactions];
        }
        // fetches transactions of fa2 tokens
        const fa2TransactionsResponse = await fetch(
          `https://api.mainnet.tzkt.io/v1/operations/transactions?target.in=${addresses.join(
            ","
          )}&parameter.[0].txs.[0].to_=${$store.userAddress}&level.ge=${
            currentLevel - 60 * 24 * daysInThePast
          }&limit=200`
        );
        if (fa2TransactionsResponse) {
          const fa2Transactions = await fa2TransactionsResponse.json();
          unprocessedTxs = [...unprocessedTxs, ...fa2Transactions];
        }

        unprocessedTxs.sort((a, b) => b.id - a.id);

        lastTransactions = [
          ...unprocessedTxs.map(tx => createNewOpEntry(tx, $store.tokens))
        ];
      }
    }
  });
</script>

<style lang="scss">
  .material-icons {
    vertical-align: bottom;
  }

  a {
    text-decoration: none;
    color: inherit;

    &:hover {
      text-decoration: underline;
    }
  }

  h2 {
    text-align: center;
  }
</style>

<div>
  <a href="/#/">
    <span class="material-icons"> arrow_back </span> Back
  </a>
</div>
<h2>Your profile</h2>
<br /><br />
<LastOperations lastOps={lastTransactions} filterOps={{ opType: "user" }} />
