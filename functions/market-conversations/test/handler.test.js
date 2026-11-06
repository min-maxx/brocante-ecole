import assert from "node:assert/strict";
import test from "node:test";
import { createMarketplaceConversationHandler } from "../src/handler.js";

function createContext({ body, userId = "family-1", method = "POST" }) {
  const response = { body: undefined, statusCode: undefined };
  return {
    response,
    context: {
      req: {
        method,
        headers: userId ? { "x-appwrite-user-id": userId } : {},
        bodyJson: body,
      },
      res: {
        json(value, statusCode = 200) {
          response.body = value;
          response.statusCode = statusCode;
          return response;
        },
      },
      error() {},
    },
  };
}

test("a family outside a conversation cannot read or append its messages", async () => {
  let messageCreated = false;
  let previewUpdated = false;
  const handler = createMarketplaceConversationHandler({
    getRequest: async () => ({
      $id: "request-1",
      buyerId: "buyer-1",
      sellerId: "seller-1",
      status: "pending",
    }),
    createMessage: async () => { messageCreated = true; },
    updateRequestLastMessage: async () => { previewUpdated = true; },
  });
  const { context, response } = createContext({
    userId: "other-family",
    body: {
      action: "send-message",
      requestId: "request-1",
      content: "A message from outside the conversation.",
    },
  });

  await handler(context);

  assert.equal(response.statusCode, 403);
  assert.equal(response.body.code, "not_participant");
  assert.equal(messageCreated, false);
  assert.equal(previewUpdated, false);
});

test("a buyer starts an offer conversation using the listing and authenticated account", async () => {
  let savedRequest;
  const savedMessages = [];
  let grantedParticipants;
  const listing = {
    $id: "listing-1",
    title: "Pull en laine",
    price: 4,
    photoIds: ["photo-1"],
    sellerId: "forged-seller",
    sellerInitials: "S. V.",
    $permissions: ['update("user:seller-1")'],
  };
  const handler = createMarketplaceConversationHandler({
    getListing: async () => listing,
    getBuyerRequestForListing: async () => null,
    getUserInitials: async () => "F. T.",
    createRequest: async ({ data, participants }) => {
      savedRequest = data;
      grantedParticipants = participants;
      return { ...data, $id: "request-1" };
    },
    createMessage: async (input) => {
      savedMessages.push(input);
      return { $id: `message-${savedMessages.length}`, ...input };
    },
    deleteMessage: async () => {},
  });
  const { context, response } = createContext({
    userId: "buyer-1",
    body: {
      action: "create-request",
      listingId: "listing-1",
      listingTitle: "Forged title",
      sellerId: "other-seller",
      type: "offer",
      amount: 3,
      message: "Bonjour, cet article est-il disponible ?",
    },
  });

  await handler(context);

  assert.equal(response.statusCode, 201);
  assert.equal(savedRequest.listingTitle, "Pull en laine");
  assert.equal(savedRequest.sellerId, "seller-1");
  assert.equal(savedRequest.buyerId, "buyer-1");
  assert.equal(savedRequest.buyerInitials, "F. T.");
  assert.equal(savedRequest.lastMessage, "Bonjour, cet article est-il disponible ?");
  assert.deepEqual(grantedParticipants, ["buyer-1", "seller-1"]);
  assert.deepEqual(savedMessages.map(({ requestId, senderId, content, kind, amount, status }) => ({
    requestId, senderId, content, kind, amount, status,
  })), [
    { requestId: "request-1", senderId: "buyer-1", content: "Offre : 3 €", kind: "offer", amount: 3, status: "pending" },
    { requestId: "request-1", senderId: "buyer-1", content: "Bonjour, cet article est-il disponible ?", kind: "message", amount: undefined, status: undefined },
  ]);
  assert.deepEqual(savedMessages.map(({ participants }) => participants), [
    ["buyer-1", "seller-1"],
    ["buyer-1", "seller-1"],
  ]);
  assert.equal(response.body.request.$id, "request-1");
  assert.equal(response.body.messages[0].content, "Offre : 3 €");
  assert.equal(response.body.messages[1].content, "Bonjour, cet article est-il disponible ?");
});

test("a buyer reuses the existing listing conversation instead of creating another request", async () => {
  const existingRequest = { $id: "request-1", listingId: "listing-1", buyerId: "buyer-1" };
  let created = false;
  const handler = createMarketplaceConversationHandler({
    getListing: async () => ({
      $id: "listing-1",
      title: "Pull en laine",
      price: 4,
      $permissions: ['update("user:seller-1")'],
    }),
    getBuyerRequestForListing: async () => existingRequest,
    createRequest: async () => { created = true; },
  });
  const { context, response } = createContext({
    userId: "buyer-1",
    body: { action: "create-request", listingId: "listing-1", type: "offer", amount: 3 },
  });

  await handler(context);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.existing, true);
  assert.equal(response.body.request.$id, existingRequest.$id);
  assert.deepEqual(response.body.messages, []);
  assert.equal(created, false);
});

test("a concurrent duplicate request opens the conversation created by the other submit", async () => {
  const existingRequest = { $id: "request-1", listingId: "listing-1", buyerId: "buyer-1" };
  let lookupCount = 0;
  const handler = createMarketplaceConversationHandler({
    getListing: async () => ({
      $id: "listing-1",
      title: "Pull en laine",
      price: 4,
      $permissions: ['update("user:seller-1")'],
    }),
    getBuyerRequestForListing: async () => (++lookupCount === 1 ? null : existingRequest),
    getUserInitials: async () => "F. T.",
    createRequest: async () => { throw Object.assign(new Error("Duplicate"), { code: 409 }); },
    createMessage: async () => assert.fail("a duplicate request must not create another message"),
  });
  const { context, response } = createContext({
    userId: "buyer-1",
    body: { action: "create-request", listingId: "listing-1", type: "offer", amount: 3 },
  });

  await handler(context);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.existing, true);
  assert.equal(response.body.request.$id, existingRequest.$id);
  assert.deepEqual(response.body.messages, []);
});

test("the seller accepts an offer, reserves its listing, and rejects other pending requests", async () => {
  const listing = {
    $id: "listing-1",
    status: "available",
    $permissions: ['update("user:seller-1")'],
  };
  const requests = [
    { $id: "request-1", listingId: "listing-1", buyerId: "buyer-1", sellerId: "seller-1", type: "offer", status: "pending" },
    { $id: "request-2", listingId: "listing-1", buyerId: "buyer-2", sellerId: "seller-1", type: "offer", status: "pending" },
  ];
  const offerMessages = {
    "request-1": {
      $id: "offer-message-1",
      kind: "offer",
      amount: 3,
      status: "pending",
    },
    "request-2": {
      $id: "offer-message-2",
      kind: "offer",
      amount: 2,
      status: "pending",
    },
  };
  const handler = createMarketplaceConversationHandler({
    createTransaction: async () => ({ $id: "transaction-1" }),
    commitTransaction: async () => {},
    rollbackTransaction: async () => {},
    getRequest: async (requestId) => requests.find((request) => request.$id === requestId),
    getListing: async () => listing,
    listRequestsByListing: async () => requests,
    listMessagesByRequest: async (requestId) => [offerMessages[requestId]],
    updateMessageStatus: async (messageId, status) => {
      const offerMessage = Object.values(offerMessages).find((item) => item.$id === messageId);
      offerMessage.status = status;
      return offerMessage;
    },
    updateRequestStatus: async (requestId, status) => {
      const request = requests.find((item) => item.$id === requestId);
      request.status = status;
      return request;
    },
    updateListingStatus: async (_listingId, status) => {
      listing.status = status;
      return listing;
    },
  });
  const { context, response } = createContext({
    userId: "seller-1",
    body: { action: "respond-to-offer", requestId: "request-1", decision: "accepted" },
  });

  await handler(context);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.request.status, "accepted");
  assert.equal(response.body.listing.status, "reserved");
  assert.equal(response.body.messages[0].status, "accepted");
  assert.equal(offerMessages["request-2"].status, "rejected");
  assert.deepEqual(response.body.requests.map(({ $id, status }) => [$id, status]), [
    ["request-1", "accepted"],
    ["request-2", "rejected"],
  ]);
});

test("only the seller can decide a pending offer", async () => {
  let decisionApplied = false;
  const handler = createMarketplaceConversationHandler({
    getRequest: async () => ({ $id: "request-1", buyerId: "buyer-1", sellerId: "seller-1", status: "pending" }),
    updateRequestStatus: async () => { decisionApplied = true; },
  });
  const { context, response } = createContext({
    userId: "buyer-1",
    body: { action: "respond-to-offer", requestId: "request-1", decision: "rejected" },
  });

  await handler(context);

  assert.equal(response.statusCode, 403);
  assert.equal(response.body.code, "not_seller");
  assert.equal(decisionApplied, false);
});

test("the buyer makes a new offer in the existing conversation after refusal", async () => {
  const request = {
    $id: "request-1",
    listingId: "listing-1",
    buyerId: "buyer-1",
    sellerId: "seller-1",
    type: "offer",
    amount: 3,
    status: "rejected",
  };
  const listing = {
    $id: "listing-1",
    status: "available",
    $permissions: ['update("user:seller-1")'],
  };
  const messages = [];
  const handler = createMarketplaceConversationHandler({
    createTransaction: async () => ({ $id: "transaction-1" }),
    commitTransaction: async () => {},
    rollbackTransaction: async () => {},
    getRequest: async () => request,
    getListing: async () => listing,
    listMessagesByRequest: async () => messages,
    createMessage: async (input) => {
      const message = { $id: `message-${messages.length + 1}`, ...input };
      messages.push(message);
      return message;
    },
    updateRequestOffer: async (_requestId, data) => Object.assign(request, data),
  });
  const { context, response } = createContext({
    userId: "buyer-1",
    body: { action: "renew-offer", requestId: "request-1", amount: 2 },
  });

  await handler(context);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.request.$id, "request-1");
  assert.equal(response.body.request.amount, 2);
  assert.equal(response.body.request.status, "pending");
  assert.deepEqual(messages.map(({ kind, amount, status }) => [kind, amount, status]), [
    ["offer", 3, "rejected"],
    ["offer", 2, "pending"],
  ]);
  assert.equal(response.body.messages.at(-1).content, "Offre : 2 €");
});

test("the seller refuses an offer without reserving the listing", async () => {
  const request = {
    $id: "request-1",
    listingId: "listing-1",
    buyerId: "buyer-1",
    sellerId: "seller-1",
    type: "offer",
    amount: 3,
    status: "pending",
  };
  const listing = {
    $id: "listing-1",
    status: "available",
    $permissions: ['update("user:seller-1")'],
  };
  const offerMessage = {
    $id: "offer-message-1",
    kind: "offer",
    amount: 3,
    status: "pending",
  };
  const handler = createMarketplaceConversationHandler({
    createTransaction: async () => ({ $id: "transaction-1" }),
    commitTransaction: async () => {},
    rollbackTransaction: async () => {},
    getRequest: async () => request,
    getListing: async () => listing,
    listMessagesByRequest: async () => [offerMessage],
    updateMessageStatus: async (_messageId, status) => {
      offerMessage.status = status;
      return offerMessage;
    },
    updateRequestStatus: async (_requestId, status) => Object.assign(request, { status }),
    updateListingStatus: async () => assert.fail("refusing an offer must not reserve the listing"),
  });
  const { context, response } = createContext({
    userId: "seller-1",
    body: { action: "respond-to-offer", requestId: "request-1", decision: "rejected" },
  });

  await handler(context);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.request.status, "rejected");
  assert.equal(response.body.listing.status, "available");
  assert.equal(response.body.messages[0].status, "rejected");
});

test("a concurrent conversation change rolls back the seller decision", async () => {
  let rollbackCount = 0;
  const handler = createMarketplaceConversationHandler({
    createTransaction: async () => ({ $id: "transaction-1" }),
    commitTransaction: async () => {
      throw Object.assign(new Error("Conflict"), { code: 409, type: "transaction_conflict" });
    },
    rollbackTransaction: async () => { rollbackCount += 1; },
    getRequest: async () => ({
      $id: "request-1",
      listingId: "listing-1",
      buyerId: "buyer-1",
      sellerId: "seller-1",
      type: "offer",
      amount: 3,
      status: "pending",
    }),
    getListing: async () => ({
      $id: "listing-1",
      status: "available",
      $permissions: ['update("user:seller-1")'],
    }),
    listMessagesByRequest: async () => [{
      $id: "offer-message-1",
      kind: "offer",
      amount: 3,
      status: "pending",
    }],
    updateMessageStatus: async (_messageId, status) => ({ status }),
    updateRequestStatus: async (_requestId, status) => ({ status }),
    updateListingStatus: async (_listingId, status) => ({ status }),
    listRequestsByListing: async () => [],
  });
  const { context, response } = createContext({
    userId: "seller-1",
    body: { action: "respond-to-offer", requestId: "request-1", decision: "accepted" },
  });

  await handler(context);

  assert.equal(response.statusCode, 409);
  assert.equal(response.body.code, "request_changed");
  assert.equal(rollbackCount, 1);
});

test("a buyer cannot renew an offer for a reserved listing", async () => {
  let offerChanged = false;
  const handler = createMarketplaceConversationHandler({
    getRequest: async () => ({
      $id: "request-1",
      listingId: "listing-1",
      buyerId: "buyer-1",
      sellerId: "seller-1",
      type: "offer",
      amount: 3,
      status: "rejected",
    }),
    getListing: async () => ({
      $id: "listing-1",
      status: "reserved",
      $permissions: ['update("user:seller-1")'],
    }),
    listMessagesByRequest: async () => [],
    createMessage: async () => { offerChanged = true; },
    updateRequestOffer: async () => { offerChanged = true; },
  });
  const { context, response } = createContext({
    userId: "buyer-1",
    body: { action: "renew-offer", requestId: "request-1", amount: 2 },
  });

  await handler(context);

  assert.equal(response.statusCode, 409);
  assert.equal(response.body.code, "listing_not_available");
  assert.equal(offerChanged, false);
});
