import { writable, get } from "svelte/store";
import type { LocalStorageState, TezosAccountAddress } from "./types";
import { AvailableFiat, AvailableToken, AvailableInvestments } from "./types";
import generalStore from "./store";

let state = null;
const localStorageItemName = "mtd";
const version = "3.0.1";
let initialState: LocalStorageState = {
  preferredFiat: AvailableFiat.USD,
  pushNotifications: false,
  favoriteTokens: [],
  favoriteInvestments: [],
  lastUpdate: Date.now()
};

const wrapUserState = (
  state: LocalStorageState,
  userAddress: TezosAccountAddress
) => {
  if (userAddress) {
    return { [userAddress]: state, version };
  } else {
    return { unknown: state, version };
  }
};

if (globalThis?.window?.localStorage) {
  /*const localStorage = window.localStorage.getItem(localStorageItemName);
  if (localStorage) {
    // gets the local storage
    const stateFromStorage = JSON.parse(localStorage);
    if (stateFromStorage.version !== initialState.version) {
      initialState = { ...initialState, ...stateFromStorage };
      // updates the local storage
      window.localStorage.setItem(
        localStorageItemName,
        JSON.stringify(initialState)
      );
    } else {
      initialState = { ...stateFromStorage };
    }
  } else {
    // sets up the local storage
    window.localStorage.setItem(
      localStorageItemName,
      JSON.stringify(initialState)
    );
  }*/
  const store = writable(undefined);

  state = {
    subscribe: store.subscribe,
    init: (userAddress: TezosAccountAddress) => {
      store.update(store => {
        if (!store) {
          const localStorage =
            window.localStorage.getItem(localStorageItemName);
          if (localStorage) {
            // gets the local storage
            const stateFromStorage = JSON.parse(localStorage);
            if (stateFromStorage.version !== version) {
              initialState = { ...stateFromStorage[userAddress] };
              // updates the local storage
              window.localStorage.setItem(
                localStorageItemName,
                JSON.stringify(wrapUserState(initialState, userAddress))
              );
            } else {
              initialState = { ...stateFromStorage[userAddress] };
            }

            return initialState;
          } else {
            // sets up the local storage
            window.localStorage.setItem(
              localStorageItemName,
              JSON.stringify(wrapUserState(initialState, userAddress))
            );

            return initialState;
          }
        } else {
          return store;
        }
      });
    },
    updateFiat: (fiat: AvailableFiat, exchangeRate: number) => {
      store.update(store => {
        const gnrlStore = get(generalStore);
        const newStore = {
          ...store,
          preferredFiat: fiat,
          xtzExchangeRate: exchangeRate,
          lastUpdate: Date.now()
        };
        window.localStorage.setItem(
          localStorageItemName,
          JSON.stringify(wrapUserState(newStore, gnrlStore.userAddress))
        );
        return newStore;
      });
    },
    addFavoriteToken: (tokenSymbol: AvailableToken) => {
      store.update(store => {
        const gnrlStore = get(generalStore);
        const newStore = {
          ...store,
          favoriteTokens: !store.favoriteTokens.includes(tokenSymbol)
            ? [...store.favoriteTokens, tokenSymbol]
            : store.favoriteTokens
        };
        window.localStorage.setItem(
          localStorageItemName,
          JSON.stringify(wrapUserState(newStore, gnrlStore.userAddress))
        );
        return newStore;
      });
    },
    removeFavoriteToken: (tokenSymbol: AvailableToken) => {
      store.update(store => {
        const gnrlStore = get(generalStore);
        const newStore = {
          ...store,
          favoriteTokens: [
            ...store.favoriteTokens.filter(tk => tk !== tokenSymbol)
          ]
        };
        window.localStorage.setItem(
          localStorageItemName,
          JSON.stringify(wrapUserState(newStore, gnrlStore.userAddress))
        );
        return newStore;
      });
    },
    addFavoriteInvestment: (investment: AvailableInvestments) => {
      store.update(store => {
        const gnrlStore = get(generalStore);
        const newStore = {
          ...store,
          favoriteInvestments: !store.favoriteInvestments.includes(investment)
            ? [...store.favoriteInvestments, investment]
            : store.favoriteInvestments
        };
        window.localStorage.setItem(
          localStorageItemName,
          JSON.stringify(wrapUserState(newStore, gnrlStore.userAddress))
        );
        return newStore;
      });
    },
    removeFavoriteInvestment: (investment: AvailableInvestments) => {
      store.update(store => {
        const gnrlStore = get(generalStore);
        const newStore = {
          ...store,
          favoriteInvestments: [
            ...store.favoriteInvestments.filter(inv => inv !== investment)
          ]
        };
        window.localStorage.setItem(
          localStorageItemName,
          JSON.stringify(wrapUserState(newStore, gnrlStore.userAddress))
        );
        return newStore;
      });
    }
  };
}

export default state;
