import type { State, AvailableFiat } from "./types";
import { TezosToolkit, MichelCodecPacker } from "@taquito/taquito";
import {
  findDex,
  estimateSwap,
  estimateTezInToken,
  estimateTokenInTez
} from "@quipuswap/sdk";
import config from "./config";

const ctx: Worker = self as any;
let localNetwork;

let getExchangeRatesInterval, xtzFiatExchangeRateInterval;
let Tezos: TezosToolkit;
let localTokens: State["tokens"];
let localFiat: AvailableFiat;
let xtzFiatExchangeRate = 0;

const getTokensExchangeRates = async () => {
  const factories = config.quipuswapFactories;

  const exchangeRates = await Promise.all(
    Object.entries(localTokens).map(async localToken => {
      const [tokenSymbol, tokenInfo] = localToken;
      let token;
      if (tokenInfo.type === "fa2") {
        if (
          Array.isArray(tokenInfo.ledgerKey) &&
          tokenInfo.ledgerKey[0] === "address" &&
          !isNaN(+tokenInfo.ledgerKey[1])
        ) {
          token = {
            contract: tokenInfo.address[localNetwork],
            id: tokenInfo.ledgerKey[1]
          };
        } else {
          token = {
            contract: tokenInfo.address[localNetwork],
            id: 0
          };
        }
      } else {
        token = { contract: tokenInfo.address[localNetwork] };
      }

      try {
        const dex = await findDex(Tezos, factories, token);
        if (dex) {
          const tokenValue = 1 * 10 ** tokenInfo.decimals;

          // calculates estimated swap price from QuipuSwap
          const estimatedTokenToTezSwap = await estimateSwap(
            Tezos,
            factories,
            token,
            "tez",
            {
              inputValue: tokenValue
            }
          );
          const estimatedTezToTokenSwap = await estimateSwap(
            Tezos,
            factories,
            "tez",
            token,
            {
              inputValue: 1_000_000
            }
          );

          // calculates real price
          const inTezValue = estimateTezInToken(
            await dex.contract.storage(),
            tokenValue
          );
          const inTokenValue = estimateTokenInTez(
            await dex.contract.storage(),
            1_000_000
          );
          /*console.log(
            tokenSymbol,
            inTokenValue.toNumber(),
            inTokenValue.toNumber() / 10 ** tokenInfo.decimals
          );*/

          return {
            tokenSymbol,
            tezToToken:
              +(
                estimatedTezToTokenSwap.toNumber() /
                10 ** tokenInfo.decimals
              ).toFixed(5) / 1,
            tokenToTez:
              +(estimatedTokenToTezSwap.toNumber() / 10 ** 6).toFixed(5) / 1,
            realPriceInTez: inTezValue.toNumber() / 10 ** 6,
            realPriceInToken: inTokenValue.toNumber() / 10 ** tokenInfo.decimals
          };
        } else {
          console.error(tokenSymbol, "no dex");
          return undefined;
        }
      } catch (err) {
        console.error(
          `Error fetching the exchange rate for ${tokenSymbol}:`,
          err
        );
        return undefined;
      }
    })
  );

  ctx.postMessage({ type: "exchange-rates", payload: exchangeRates });
};

const fetchXtzFiatExchangeRate = async () => {
  try {
    const response = await fetch(
      //`https://api.coingecko.com/api/v3/simple/price?ids=tezos&vs_currencies=usd`
      `https://api.coingecko.com/api/v3/coins/tezos/market_chart?vs_currency=${localFiat.toLowerCase()}&days=2`
    );
    if (response) {
      const data = await response.json();
      //xtzFiatExchangeRate = +data.tezos.usd;
      const prices = data.prices;
      xtzFiatExchangeRate = prices[prices.length - 1][1];

      ctx.postMessage({
        type: "xtz-fiat-exchange-rate",
        payload: {
          xtzFiatExchangeRate,
          historicExchangeRates: prices.map(price => ({
            timestamp: price[0],
            rate: price[1]
          }))
        }
      });
    } else {
      throw "No response from CoinGecko API";
    }
  } catch (error) {
    console.log(error);
    return;
  }
};

const init = async (param: {
  tokens: State["tokens"];
  rpcUrl: string;
  network: State["network"];
  fiat: AvailableFiat;
}) => {
  const { tokens, rpcUrl, network, fiat } = param;
  localTokens = tokens;
  localNetwork = network;
  localFiat = fiat;
  Tezos = new TezosToolkit(rpcUrl);
  Tezos.setPackerProvider(new MichelCodecPacker());

  // sets up fetching tokens exchange rates
  await getTokensExchangeRates();
  getExchangeRatesInterval = setInterval(getTokensExchangeRates, 60000);
  // sets up fetching XTZ-FIAT exchange rate
  await fetchXtzFiatExchangeRate();
  xtzFiatExchangeRateInterval = setInterval(fetchXtzFiatExchangeRate, 60000);
};

ctx.addEventListener("message", async e => {
  // removes current interval
  if (e.data.type === "init") {
    await init(e.data.payload);
  } else if (e.data.type === "change-fiat") {
    // clears current interval
    clearInterval(xtzFiatExchangeRateInterval);
    // saves new fiat
    localFiat = e.data.payload;
    // resets the interval
    await fetchXtzFiatExchangeRate();
    xtzFiatExchangeRateInterval = setInterval(fetchXtzFiatExchangeRate, 60000);
  } else if (e.data.type === "destroy") {
    clearInterval(getExchangeRatesInterval);
    clearInterval(xtzFiatExchangeRateInterval);
  }
});

ctx.postMessage("Quipu worker ready");

export {};
