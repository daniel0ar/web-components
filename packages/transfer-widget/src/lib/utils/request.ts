import {
  approveErc20,
  hasErc20Approval,
  hasSufficientFunds,
  payRequest,
} from "@requestnetwork/payment-processor";
import {
  RequestNetwork,
  Types,
  Utils,
} from "@requestnetwork/request-client.js";
import { Web3SignatureProvider } from "@requestnetwork/web3-signature";
import { constants, providers, utils } from "ethers";
import type { BuyerInfo, Currency, ProductInfo, SellerInfo } from "../types";
import { chains } from "./chains";

export const prepareRequestParameters = ({
  currency,
  sellerAddress,
  amountInCrypto,
  exchangeRate,
  amountInUSD,
  createdWith,
  builderId,
  productInfo,
  sellerInfo,
  buyerInfo,
  invoiceNumber,
  feeAddress,
  feeAmountInUSD,
  feeAmountInCrypto,
  totalAmountInCrypto,
}: {
  currency: Currency;
  sellerAddress: string;
  amountInCrypto: number;
  exchangeRate: number;
  amountInUSD: number;
  builderId: string;
  createdWith: string;
  productInfo: ProductInfo | undefined;
  sellerInfo: SellerInfo;
  buyerInfo: BuyerInfo;
  invoiceNumber?: string;
  feeAddress: string;
  feeAmountInUSD: number;
  feeAmountInCrypto: number;
  totalAmountInCrypto: number;
}) => {
  const isERC20 = currency.type === Types.RequestLogic.CURRENCY.ERC20;
  const currencyValue = isERC20 ? currency.address : "eth";
  const amount = utils
    .parseUnits(
      totalAmountInCrypto.toFixed(currency.decimals),
      currency.decimals
    )
    .toString();

  let note = `Sale made with ${currency.symbol} on ${currency.network} for amount of ${amountInUSD} USD with an exchange rate of ${exchangeRate}. `;

  if (feeAddress !== constants.AddressZero && feeAmountInUSD) {
    note += `Fee of ${feeAmountInUSD} USD/${feeAmountInCrypto} ${currency.symbol} was paid by the buyer to ${feeAddress}.`;
  }

  const invoiceItems = [
    {
      name: productInfo?.name || "Unnamed product",
      quantity: 1,
      unitPrice: utils
        .parseUnits(
          amountInCrypto.toFixed(currency.decimals),
          currency.decimals
        )
        .toString(),
      discount: "0",
      tax: {
        type: "percentage",
        amount: "0",
      },
      currency: isERC20 ? currency.address : currency.symbol,
    },
  ];

  if (feeAmountInCrypto > 0) {
    invoiceItems.push({
      name: "Fee",
      quantity: 1,
      unitPrice: utils
        .parseUnits(
          feeAmountInCrypto.toFixed(currency.decimals),
          currency.decimals
        )
        .toString(),
      discount: "0",
      tax: {
        type: "percentage",
        amount: "0",
      },
      currency: isERC20 ? currency.address : currency.symbol,
    });
  }

  return {
    requestInfo: {
      currency: {
        type: currency.type,
        value: currencyValue,
        network: currency.network,
      },
      expectedAmount: amount,
      payee: {
        type: Types.Identity.TYPE.ETHEREUM_ADDRESS,
        value: sellerAddress,
      },
      payer: {
        type: Types.Identity.TYPE.ETHEREUM_ADDRESS,
        value: "0x32B2304953a56Be7eb58a5b564Be1b6A5358761A",
      },
      timestamp: Utils.getCurrentTimestampInSecond(),
    },
    paymentNetwork: {
      id: isERC20
        ? Types.Extension.PAYMENT_NETWORK_ID.ERC20_FEE_PROXY_CONTRACT
        : Types.Extension.PAYMENT_NETWORK_ID.ETH_FEE_PROXY_CONTRACT,
      parameters: {
        paymentNetworkName: currency.network,
        paymentAddress: sellerAddress,
        feeAddress: feeAddress,
        feeAmount: utils
          .parseUnits(
            feeAmountInCrypto.toFixed(currency.decimals),
            currency.decimals
          )
          .toString(),
      },
    },
    contentData: {
      meta: {
        format: "rnf_invoice",
        version: "0.0.3",
      },
      creationDate: new Date().toISOString(),
      invoiceNumber: invoiceNumber || "receipt",
      note: note,
      sellerInfo: {
        email: sellerInfo?.email || undefined,
        firstName: sellerInfo?.firstName || undefined,
        lastName: sellerInfo?.lastName || undefined,
        businessName: sellerInfo?.businessName || undefined,
        phone: sellerInfo?.phone || undefined,
        address: sellerInfo?.address
          ? {
              streetAddress: sellerInfo.address["street-address"] || undefined,
              locality: sellerInfo.address.locality || undefined,
              postalCode: sellerInfo.address["postal-code"] || undefined,
              country: sellerInfo.address["country-name"] || undefined,
            }
          : undefined,
        taxRegistration: sellerInfo?.taxRegistration || undefined,
      },
      buyerInfo: {
        email: buyerInfo?.email || undefined,
        firstName: buyerInfo?.firstName || undefined,
        lastName: buyerInfo?.lastName || undefined,
        businessName: buyerInfo?.businessName || undefined,
        phone: buyerInfo?.phone || undefined,
        address: buyerInfo?.address
          ? {
              streetAddress: buyerInfo.address["street-address"] || undefined,
              locality: buyerInfo.address.locality || undefined,
              postalCode: buyerInfo.address["postal-code"] || undefined,
              country: buyerInfo.address["country-name"] || undefined,
            }
          : undefined,
        taxRegistration: buyerInfo?.taxRegistration || undefined,
      },
      invoiceItems,
      paymentTerms: {
        dueDate: new Date().toISOString(),
      },
      miscellaneous: {
        exchangeRate: exchangeRate.toString(),
        amountInUSD: amountInUSD.toString(),
        createdWith,
        feeAddress,
        feeAmountInUSD,
        feeAmountInCrypto,
        builderId,
        paymentCurrency: {
          type: currency.type,
          value: currencyValue,
          network: currency.network,
        },
      },
    },
    signer: {
      type: Types.Identity.TYPE.ETHEREUM_ADDRESS,
      value: "0x32B2304953a56Be7eb58a5b564Be1b6A5358761A",
    },
  };
};

export const handleRequestPayment = async ({
  requestParameters,
  persistRequest,
}: {
  requestParameters: any;
  persistRequest: boolean;
}) => {

  const isERC20 =
    requestParameters.requestInfo.currency.type ===
    Types.RequestLogic.CURRENCY.ERC20;


  const web3SignatureProvider = new Web3SignatureProvider(
    ethersProvider!.provider
  );

  const inMemoryRequestNetwork = new RequestNetwork({
    nodeConnectionConfig: {
      baseURL: "https://gnosis.gateway.request.network",
    },
    signatureProvider: web3SignatureProvider,
    skipPersistence: true,
  });

  let inMemoryRequest =
    await inMemoryRequestNetwork.createRequest(requestParameters);

  const confirmationBlocks = 1;
  if (isERC20) {
    const requestData = inMemoryRequest.inMemoryInfo?.requestData!;

    const _hasSufficientFunds = await hasSufficientFunds({
      request: inMemoryRequest.inMemoryInfo?.requestData!,
      address: payerAddress,
      providerOptions: {
        provider: ethersProvider!,
      },
    });

    if (!_hasSufficientFunds) {
      throw new Error("Insufficient funds");
    }

    const _hasApproval = await hasErc20Approval(
      requestData,
      payerAddress,
      ethersProvider!
    );

    if (!_hasApproval) {
      const _approve = await approveErc20(
        inMemoryRequest.inMemoryInfo?.requestData!,
        signer
      );
      await _approve.wait(confirmationBlocks);
    }
  }

  const paymentTx = await payRequest(
    inMemoryRequest.inMemoryInfo?.requestData!,
    signer
  );

  await paymentTx.wait(confirmationBlocks);

  const persistingRequestNetwork = new RequestNetwork({
    nodeConnectionConfig: {
      baseURL: "https://gnosis.gateway.request.network",
    },
  });

  if (persistRequest) {
    await persistingRequestNetwork.persistRequest(inMemoryRequest);
  }

  if (inMemoryRequest?.inMemoryInfo?.requestData) {
    inMemoryRequest.inMemoryInfo.requestData = {
      ...inMemoryRequest.inMemoryInfo.requestData,
      payer: requestParameters.requestInfo.payer,
      payee: requestParameters.requestInfo.payee,
    };
  }

  return inMemoryRequest;
};
