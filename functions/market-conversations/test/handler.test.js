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
  let savedMessage;
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
    getUserInitials: async () => "F. T.",
    createRequest: async ({ data, participants }) => {
      savedRequest = data;
      grantedParticipants = participants;
      return { ...data, $id: "request-1" };
    },
    createMessage: async (input) => {
      savedMessage = input;
      return { $id: "message-1", requestId: input.requestId, content: input.content };
    },
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
  assert.deepEqual(savedMessage, {
    requestId: "request-1",
    senderId: "buyer-1",
    content: "Bonjour, cet article est-il disponible ?",
    participants: ["buyer-1", "seller-1"],
  });
  assert.equal(response.body.request.$id, "request-1");
  assert.equal(response.body.messages[0].content, "Bonjour, cet article est-il disponible ?");
});
