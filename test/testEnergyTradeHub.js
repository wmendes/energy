const EnergyTradeHub = artifacts.require("EnergyTradeHub");

contract("EnergyTradeHub", (accounts) => {
  const [admin, provider, consumer, unauthorized] = accounts;

  let energyTradeHub;

  beforeEach(async () => {
    energyTradeHub = await EnergyTradeHub.new();
  });

  it("ADMIN_ROLE should be able to assign roles", async () => {
    try {
      const providerRole = await energyTradeHub.PROVIDER_ROLE();
      const consumerRole = await energyTradeHub.CONSUMER_ROLE();

      await energyTradeHub.grantRole(providerRole, provider, { from: admin });
      assert.isTrue(
        await energyTradeHub.hasRole(providerRole, provider),
        "Provider should be granted provider role"
      );

      await energyTradeHub.grantRole(consumerRole, consumer, { from: admin });
      assert.isTrue(
        await energyTradeHub.hasRole(consumerRole, consumer),
        "Consumer should be granted consumer role"
      );
    } catch (error) {
      assert.fail(`Test failed with error: ${error.message}`);
    }
  });

  it("PROVIDER_ROLE and CONSUMER_ROLE should not be able to assign roles", async () => {
    const providerRole = await energyTradeHub.PROVIDER_ROLE();
    const consumerRole = await energyTradeHub.CONSUMER_ROLE();

    try {
      await energyTradeHub.grantRole(providerRole, unauthorized, {
        from: provider,
      });
      assert.fail("Provider should not be able to assign roles");
    } catch (error) {
      // Expected error
    }

    try {
      await energyTradeHub.grantRole(consumerRole, unauthorized, {
        from: consumer,
      });
      assert.fail("Consumer should not be able to assign roles");
    } catch (error) {
      // Expected error
    }
  });

  // Check that an admin can revoke roles successfully
  it("should allow ADMIN_ROLE to revoke roles", async () => {
    const providerRole = await energyTradeHub.PROVIDER_ROLE();
    await energyTradeHub.grantRole(providerRole, provider, { from: admin });
    assert.isTrue(
      await energyTradeHub.hasRole(providerRole, provider),
      "Provider should have provider role"
    );

    await energyTradeHub.revokeRole(providerRole, provider, { from: admin });
    assert.isFalse(
      await energyTradeHub.hasRole(providerRole, provider),
      "Provider role should be revoked"
    );
  });

  // Test for role transfer
  it("should allow transfer of roles", async () => {
    const consumerRole = await energyTradeHub.CONSUMER_ROLE();
    await energyTradeHub.grantRole(consumerRole, consumer, { from: admin });

    await energyTradeHub.revokeRole(consumerRole, consumer, { from: admin });
    await energyTradeHub.grantRole(consumerRole, provider, { from: admin });

    assert.isFalse(
      await energyTradeHub.hasRole(consumerRole, consumer),
      "Consumer should no longer have the role"
    );
    assert.isTrue(
      await energyTradeHub.hasRole(consumerRole, provider),
      "Provider should have the role transferred from consumer"
    );
  });

  // Test successful token creation with detailed parameters
  it("should allow token creation with detailed attributes and track them correctly", async () => {
    const providerRole = await energyTradeHub.PROVIDER_ROLE();
    await energyTradeHub.grantRole(providerRole, provider, { from: admin });

    // Sample data for token creation
    const energyType = "Solar";
    const validFrom = Date.now();
    const validTo = validFrom + 1000; // Example increment
    const startTime = validFrom;
    const endTime = validTo;
    const amountInKw = 1000;
    const tokenURI = "http://example.com/token";

    const tx = await energyTradeHub.createToken(
      energyType,
      validFrom,
      validTo,
      startTime,
      endTime,
      amountInKw,
      tokenURI,
      { from: provider }
    );

    const tokenId = tx.logs[0].args.tokenId.toNumber();

    const tokenDetails = await energyTradeHub.tokens(tokenId);

    assert.equal(
      tokenDetails.energyType,
      energyType,
      "Energy type should match"
    );
    assert.equal(tokenDetails.validFrom, validFrom, "Valid from should match");
    assert.equal(tokenDetails.validTo, validTo, "Valid to should match");
    assert.equal(tokenDetails.startTime, startTime, "Start time should match");
    assert.equal(tokenDetails.endTime, endTime, "End time should match");
    assert.equal(
      tokenDetails.amountInKw,
      amountInKw,
      "Amount in kW should match"
    );
  });

  // Test ownership and URI assignment after token creation
  it("should assign the correct owner and URI to the newly created token", async () => {
    const providerRole = await energyTradeHub.PROVIDER_ROLE();
    await energyTradeHub.grantRole(providerRole, provider, { from: admin });

    const tokenURI = "http://example.com/token2";
    const tx = await energyTradeHub.createToken(
      "Wind",
      Date.now(),
      Date.now() + 1000,
      Date.now(),
      Date.now() + 1000,
      500,
      tokenURI,
      { from: provider }
    );
    const tokenId = tx.logs[0].args.tokenId.toNumber();

    const ownerOfToken = await energyTradeHub.ownerOf(tokenId);
    const tokenUri = await energyTradeHub.tokenURI(tokenId);

    assert.equal(
      ownerOfToken,
      provider,
      "The provider should own the created token"
    );
    assert.equal(tokenUri, tokenURI, "The token URI should be set correctly");
  });

  // Test role-based restrictions on token creation are enforced
  it("should enforce that only providers can create tokens", async () => {
    const providerRole = await energyTradeHub.PROVIDER_ROLE();
    await energyTradeHub.grantRole(providerRole, provider, { from: admin });

    // Provider creates a token successfully
    try {
      const tokenId = await energyTradeHub.createToken(
        "Hydro",
        Date.now(),
        Date.now() + 1000,
        Date.now(),
        Date.now() + 1000,
        750,
        "http://example.com/token3",
        { from: provider }
      );
    } catch (error) {
      assert.fail("Provider should be able to create tokens");
    }

    // Consumer attempts to create a token and fails
    try {
      const tx = await energyTradeHub.createToken(
        "Geo",
        Date.now(),
        Date.now() + 1000,
        Date.now(),
        Date.now() + 1000,
        300,
        "http://example.com/token4",
        { from: consumer }
      );
      const tokenId = tx.logs[0].args.tokenId.toNumber();

      assert.fail("Consumer should not be able to create tokens");
    } catch (error) {
      assert.include(
        error.message,
        "revert",
        "Only a provider should be able to create tokens"
      );
    }
  });

  // Test token listing for sale
  it("should allow a token owner to list the token for sale and record the listing details", async () => {
    const providerRole = await energyTradeHub.PROVIDER_ROLE();
    await energyTradeHub.grantRole(providerRole, provider, { from: admin });

    // Assume provider creates a token here
    let tx = await energyTradeHub.createToken(
      "Solar",
      Date.now(),
      Date.now() + 1000,
      Date.now(),
      Date.now() + 1000,
      1000,
      "http://example.com/token",
      { from: provider }
    );
    let tokenId = tx.logs[0].args.tokenId.toNumber();

    const price = web3.utils.toWei("1", "ether");
    await energyTradeHub.listTokenForSale(tokenId, price, { from: provider });

    // Assume tokenSales is a public mapping you can access for testing
    const tokenSale = await energyTradeHub.tokenSales(tokenId);
    assert.equal(
      tokenSale.isForSale,
      true,
      "Token should be marked as for sale"
    );
    assert.equal(
      tokenSale.price,
      price,
      "Sale price should be recorded correctly"
    );
  });

  // Test token sale withdrawal
  it("should allow the token owner to withdraw the token from sale", async () => {
    const providerRole = await energyTradeHub.PROVIDER_ROLE();
    await energyTradeHub.grantRole(providerRole, provider, { from: admin });

    let tx = await energyTradeHub.createToken(
      "Nuclear",
      Date.now(),
      Date.now() + 1000,
      Date.now(),
      Date.now() + 1000,
      1000,
      "http://example.com/token",
      { from: provider }
    );
    let tokenId = tx.logs[0].args.tokenId.toNumber();

    const price = web3.utils.toWei("1", "ether");
    await energyTradeHub.listTokenForSale(tokenId, price, { from: provider });

    await energyTradeHub.withdrawTokenFromSale(tokenId, { from: provider });

    const tokenSale = await energyTradeHub.tokenSales(tokenId);
    assert.equal(
      tokenSale.isForSale,
      false,
      "Token should be withdrawn from sale"
    );
  });

  // Test token purchasing
  it("should allow users to buy a listed token, transfer ownership and funds", async () => {
    const providerRole = await energyTradeHub.PROVIDER_ROLE();
    await energyTradeHub.grantRole(providerRole, provider, { from: admin });

    let tx = await energyTradeHub.createToken(
      "Geothermal",
      Date.now(),
      Date.now() + 1000,
      Date.now(),
      Date.now() + 1000,
      1000,
      "http://example.com/token",
      { from: provider }
    );
    let tokenId = tx.logs[0].args.tokenId.toNumber();
    const price = web3.utils.toWei("1", "ether");
    await energyTradeHub.listTokenForSale(tokenId, price, { from: provider });

    // Consumer tries to buy a token listed by provider
    const purchasePrice = web3.utils.toWei("1", "ether");

    // Track seller's balance before purchase
    const sellerInitialBalance = new web3.utils.BN(
      await web3.eth.getBalance(provider)
    );

    // Consumer buys the token
    await energyTradeHub.buyToken(tokenId, {
      from: consumer,
      value: purchasePrice,
    });

    // Verify new ownership
    const newOwner = await energyTradeHub.ownerOf(tokenId);
    assert.equal(
      newOwner,
      consumer,
      "Ownership should be transferred to the buyer"
    );

    // Verify seller receives funds
    const sellerFinalBalance = new web3.utils.BN(
      await web3.eth.getBalance(provider)
    );
    assert.isTrue(
      sellerFinalBalance.gt(sellerInitialBalance),
      "Seller should receive the funds"
    );
  });
});
