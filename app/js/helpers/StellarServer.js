//TODO STELLAR SERVER API
import Stellar from 'stellar-sdk';

// import StellarOffline from './StellarOffline';
import { augmentAccount, AssetInstance, REFRESH_INTERVAL } from './StellarTools';

let Server;

function traceError() {
  // console.error(e);
}
export const getServerInstance = () => Server;
// if(process.env.NODE_ENV !== 'production') {
//   return StellarOffline();
// }

export const getAccount = accountId =>
  getServerInstance()
    .loadAccount(accountId)
    .then((account) => {
      if (account) {
        return augmentAccount(account);
      }
      throw 'no account';
    })

//TODO OrderBook realization

// export const setAssetStream = (code, issuer) => { new Stellar.Asset(code, issuer)};


export const OrderbookStream = ({ selling, buying }, onmessage) =>
  getServerInstance()
    .orderbook(AssetInstance(selling), AssetInstance(buying))
    .limit(60)
    .stream({ onmessage });

export const TradesStream = ({buying, selling}, callback) =>
  getServerInstance()
      .trades()
      .forAssetPair(AssetInstance(buying), AssetInstance(selling))
      .limit(20)
      .order('desc')
      .call()
      .then(result => (callback(result)));



export const AccountStream = (accountId, callback) =>
  getServerInstance()
    .accounts()
    .accountId(accountId)
    .stream({
      onmessage: (streamAccount) => {
        callback(augmentAccount(streamAccount));
      },
      onerror: traceError,
    });

export const OffersStream = (accountId, callback) => {
  const timerId = setInterval(() => {
    getServerInstance()
      .offers('accounts', accountId)
      .order('desc')
      .call()
      .then(result => (callback(result.records)));
  }, REFRESH_INTERVAL);

  return () => clearInterval(timerId);
};

export const EffectsStream = (accountId, onmessage) =>
  getServerInstance()
    .effects()
    .forAccount(accountId)
    .order('asc')
    .stream({ onmessage });

//TODO PaymentStream realization
export const PaymentStream = (accountId, onmessage) =>
  getServerInstance()
    .payments()
    .forAccount(accountId)
    .order('asc')
    .stream({
      onmessage: (payment) => {
        // console.log("payment", payment);
        payment.transaction().then((transaction) => {
          onmessage({
            ...payment,
            transaction,
          });
        });
      },
      onerror: traceError,
    });

export const switchNetwork = (network) => {
  switch (network) {
    case 'perso':
      Server = new Stellar.Server('http://192.168.1.67:8000', { allowHttp: true });
      Stellar.Network.useTestNetwork();
      break;
    case 'public':
      Server = new Stellar.Server('https://horizon.stellar.org');
      // Server = new Stellar.Server('https://stellar.technorely.com/');
      Stellar.Network.usePublicNetwork();
      break;
    default:
    case 'test':
      Server = new Stellar.Server('https://horizon-testnet.stellar.org');
      Stellar.Network.useTestNetwork();
      break;
  }
};

//TODO ACCOUNT: generate test pair keys
export async function generateTestPair() {
  const pair = Stellar.Keypair.random();

  try {
    await fetch(`https://horizon-testnet.stellar.org/friendbot?addr=${pair.publicKey()}`);
    return pair;
  } catch (e) {
    throw e;
  }
}

switchNetwork();
// Transactions();

