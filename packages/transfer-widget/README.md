# Request Network Transfer Widget Web Component

A web component for accepting crypto payments using Request Network.

## Introduction

The Transfer Widget web component is a pre-built component that allows users to offer crypto payment via a direct transfer to a Request Network without having to modify smart contracts (uses Single Request Forwarder). It is built using Svelte but compiled to a Web Component, making it usuable in any web environment, regardless of the framework.

## Installation

To install the component, use npm:

```bash
npm install @requestnetwork/transfer-widget
```

## Usage

### Usage in React

```tsx
import TransferWidget from "@requestnetwork/transfer-widget/react";

export default function TransferPage() {
  return (
    <TransferWidget
      sellerInfo={{
        logo: "https://example.com/logo.png",
        name: "Example Store",
      }}
      productInfo={{
        name: "Digital Art Collection",
        description: "A curated collection of digital artworks.",
        image: "https://example.com/product-image.jpg",
      }}
      amountInUSD={1.5}
      sellerAddress="0x1234567890123456789012345678901234567890"
      supportedCurrencies={["ETH_MAINNET", "USDC_MAINNET", "USDC_MATIC"]}
      persistRequest={true}
      onPaymentSuccess={(request) => {
        console.log(request);
      }}
      onError={(error) => {
        console.error(error);
      }}
    />
  );
}
```

## Additional Information

For more information, see the [Request Network documentation](https://docs.request.network/).
