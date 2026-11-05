const APPWRITE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/;
const MAX_MESSAGE_LENGTH = 1000;

function invalidInput(res) {
  return res.json({ code: "invalid_input", message: "Vérifiez les données envoyées." }, 400);
}

function requestBody(req) {
  try {
    return req.bodyJson ?? JSON.parse(req.bodyText || "{}");
  } catch {
    return null;
  }
}

function listingSellerId(listing) {
  const permission = (listing.$permissions || []).find((value) => /^update\("user:[^"]+"\)$/.test(value));
  const permissionOwner = permission?.match(/^update\("user:([^"]+)"\)$/)?.[1];
  if (permissionOwner) return permissionOwner;
  return typeof listing.sellerId === "string" ? listing.sellerId : "";
}

function isNotFound(cause) {
  return cause?.code === 404 || cause?.type === "document_not_found";
}

function isTransactionConflict(cause) {
  return cause?.type === "transaction_conflict";
}

function isConflict(cause) {
  return cause?.code === 409;
}

export function createMarketplaceConversationHandler(services) {
  return async ({ req, res, error }) => {
    if (req.method !== "POST") {
      return res.json({ code: "method_not_allowed", message: "Méthode non autorisée." }, 405);
    }

    const body = requestBody(req);
    if (!body || typeof body !== "object" || Array.isArray(body)) return invalidInput(res);

    const userId = req.headers?.["x-appwrite-user-id"];
    if (typeof userId !== "string" || !APPWRITE_ID_PATTERN.test(userId)) {
      return res.json({ code: "unauthorized", message: "Connectez-vous pour continuer." }, 401);
    }

    async function runTransaction(operation) {
      const transaction = await services.createTransaction();
      try {
        const result = await operation(transaction.$id);
        await services.commitTransaction(transaction.$id);
        return result;
      } catch (cause) {
        try {
          await services.rollbackTransaction(transaction.$id);
        } catch (rollbackError) {
          error(`Impossible d’annuler la transaction Appwrite (${rollbackError instanceof Error ? rollbackError.name : "UnknownError"}).`);
        }
        throw cause;
      }
    }

    if (body.action === "create-request") {
      const { listingId, type, amount } = body;
      const content = typeof body.message === "string" ? body.message.trim() : "";
      if (
        typeof listingId !== "string"
        || !APPWRITE_ID_PATTERN.test(listingId)
        || !["offer", "donation"].includes(type)
        || !Number.isSafeInteger(amount)
        || (type === "offer" && amount < 1)
        || (type === "donation" && amount !== 0)
        || (body.message !== undefined && typeof body.message !== "string")
        || content.length > MAX_MESSAGE_LENGTH
      ) {
        return invalidInput(res);
      }

      let listing;
      try {
        listing = await services.getListing(listingId);
      } catch (cause) {
        if (isNotFound(cause)) {
          return res.json({ code: "listing_not_found", message: "Cette annonce n’est plus disponible." }, 404);
        }
        error(`La lecture de l’annonce a échoué (${cause instanceof Error ? cause.name : "UnknownError"}).`);
        return res.json({
          code: "internal_error",
          message: "La demande n’a pas pu être envoyée. Réessayez.",
        }, 500);
      }

      const sellerId = listingSellerId(listing);
      if (
        !sellerId
        || sellerId === userId
        || !Number.isSafeInteger(listing.price)
        || listing.price < 0
        || (type === "donation" && listing.price !== 0)
        || (type === "offer" && listing.price === 0)
      ) {
        return res.json({
          code: "request_not_allowed",
          message: "Cette annonce ne peut pas recevoir cette demande.",
        }, 400);
      }

      try {
        const existingRequest = await services.getBuyerRequestForListing(listing.$id, userId);
        if (existingRequest) {
          return res.json({ request: existingRequest, messages: [], existing: true });
        }
        if (listing.status && listing.status !== "available") {
          return res.json({
            code: "request_not_allowed",
            message: "Cette annonce n’est plus disponible.",
          }, 400);
        }

        const participants = [userId, sellerId];
        const lastMessage = content || (type === "donation" ? "Demande de don" : `Offre : ${amount} €`);
        const data = {
          listingId: listing.$id,
          listingTitle: listing.title,
          listingPrice: listing.price,
          listingPhotoId: Array.isArray(listing.photoIds) ? listing.photoIds[0] || "" : "",
          sellerInitials: listing.sellerInitials || "",
          buyerInitials: await services.getUserInitials(userId),
          buyerId: userId,
          sellerId,
          type,
          amount,
          status: "pending",
          lastMessage,
        };
        let request;
        try {
          request = await services.createRequest({ data, participants });
        } catch (cause) {
          if (!isConflict(cause)) throw cause;
          const concurrentRequest = await services.getBuyerRequestForListing(listing.$id, userId);
          if (!concurrentRequest) throw cause;
          return res.json({ request: concurrentRequest, messages: [], existing: true });
        }
        const messages = [];
        try {
          messages.push(await services.createMessage({
            requestId: request.$id,
            senderId: userId,
            content: type === "donation" ? "Demande de don" : `Offre : ${amount} €`,
            kind: type,
            amount,
            status: "pending",
            participants,
          }));
          if (content) {
            messages.push(await services.createMessage({
              requestId: request.$id,
              senderId: userId,
              content,
              kind: "message",
              participants,
            }));
          }
        } catch (cause) {
          for (const createdMessage of messages.reverse()) {
            try {
              await services.deleteMessage(createdMessage.$id);
            } catch (cleanupError) {
              error(`Impossible de supprimer un message après l’échec de la création de la demande (${cleanupError instanceof Error ? cleanupError.name : "UnknownError"}).`);
            }
          }
          try {
            await services.deleteRequest(request.$id);
          } catch (cleanupError) {
            error(`Impossible de supprimer la demande après l’échec de ses premiers messages (${cleanupError instanceof Error ? cleanupError.name : "UnknownError"}).`);
          }
          throw cause;
        }
        return res.json({ request, messages }, 201);
      } catch (cause) {
        error(`La création d’une demande a échoué (${cause instanceof Error ? cause.name : "UnknownError"}).`);
        return res.json({
          code: "internal_error",
          message: "La demande n’a pas pu être envoyée. Réessayez.",
        }, 500);
      }
    }

    if (body.action === "respond-to-offer") {
      const { requestId, decision } = body;
      if (
        typeof requestId !== "string"
        || !APPWRITE_ID_PATTERN.test(requestId)
        || !["accepted", "rejected"].includes(decision)
      ) {
        return invalidInput(res);
      }

      try {
        const request = await services.getRequest(requestId);
        if (request.sellerId !== userId) {
          return res.json({
            code: "not_seller",
            message: "Seul le vendeur peut répondre à cette demande.",
          }, 403);
        }
        if (request.status !== "pending" || !["offer", "donation"].includes(request.type)) {
          return res.json({
            code: "request_not_pending",
            message: "Cette demande n’est plus en attente.",
          }, 409);
        }

        const listing = await services.getListing(request.listingId);
        if (listingSellerId(listing) !== userId) {
          return res.json({
            code: "not_seller",
            message: "Seul le vendeur peut répondre à cette demande.",
          }, 403);
        }
        if (decision === "accepted" && listing.status && listing.status !== "available") {
          return res.json({
            code: "listing_not_available",
            message: "Cette annonce n’est plus disponible.",
          }, 409);
        }

        const otherRequests = decision === "accepted"
          ? await services.listRequestsByListing(listing.$id)
          : [];
        const pendingOtherRequests = otherRequests.filter((item) =>
          item.$id !== requestId && item.status === "pending"
        );
        let updatedRequest;
        let updatedListing = listing;
        const updatedRequests = [];
        const offerMessage = await runTransaction(async (transactionId) => {
          const offerMessages = (await services.listMessagesByRequest(requestId))
            .filter((message) => message.kind === request.type)
            .sort((left, right) => String(left.$createdAt || "").localeCompare(String(right.$createdAt || "")));
          const currentOffer = offerMessages.at(-1);
          const currentMessage = currentOffer?.status === "pending"
            ? await services.updateMessageStatus(currentOffer.$id, decision, transactionId)
            : await services.createMessage({
              requestId,
              senderId: request.buyerId,
              content: request.type === "donation" ? "Demande de don" : `Offre : ${Number(request.amount)} €`,
              kind: request.type,
              amount: Number(request.amount),
              status: decision,
              participants: [request.buyerId, request.sellerId],
              transactionId,
            });
          updatedRequest = await services.updateRequestStatus(requestId, decision, transactionId);
          updatedRequests.push(updatedRequest);
          if (decision === "accepted") {
            updatedListing = await services.updateListingStatus(listing.$id, "reserved", transactionId);
            for (const otherRequest of pendingOtherRequests) {
              const otherOffer = (await services.listMessagesByRequest(otherRequest.$id))
                .filter((message) => message.kind === otherRequest.type)
                .sort((left, right) => String(left.$createdAt || "").localeCompare(String(right.$createdAt || "")))
                .at(-1);
              if (otherOffer?.status === "pending") {
                await services.updateMessageStatus(otherOffer.$id, "rejected", transactionId);
              } else {
                await services.createMessage({
                  requestId: otherRequest.$id,
                  senderId: otherRequest.buyerId,
                  content: otherRequest.type === "donation" ? "Demande de don" : `Offre : ${Number(otherRequest.amount)} €`,
                  kind: otherRequest.type,
                  amount: Number(otherRequest.amount),
                  status: "rejected",
                  participants: [otherRequest.buyerId, otherRequest.sellerId],
                  transactionId,
                });
              }
              updatedRequests.push(await services.updateRequestStatus(otherRequest.$id, "rejected", transactionId));
            }
          }
          return currentMessage;
        });
        return res.json({
          request: updatedRequest,
          listing: updatedListing,
          requests: updatedRequests,
          messages: [offerMessage],
        });
      } catch (cause) {
        if (isTransactionConflict(cause)) {
          return res.json({
            code: "request_changed",
            message: "Cette annonce ou cette demande vient d’être mise à jour. Actualisez la conversation avant de réessayer.",
          }, 409);
        }
        if (isNotFound(cause)) {
          return res.json({
            code: "conversation_not_found",
            message: "Cette conversation ou cette annonce n’est plus disponible.",
          }, 404);
        }
        error(`La réponse à une demande a échoué (${cause instanceof Error ? cause.name : "UnknownError"}).`);
        return res.json({
          code: "internal_error",
          message: "La demande n’a pas pu être mise à jour. Réessayez.",
        }, 500);
      }
    }

    if (body.action === "renew-offer") {
      const { requestId, amount } = body;
      if (
        typeof requestId !== "string"
        || !APPWRITE_ID_PATTERN.test(requestId)
        || !Number.isSafeInteger(amount)
        || amount < 1
      ) {
        return invalidInput(res);
      }

      try {
        const request = await services.getRequest(requestId);
        if (request.buyerId !== userId) {
          return res.json({
            code: "not_buyer",
            message: "Seul l’acheteur peut envoyer une nouvelle offre.",
          }, 403);
        }
        if (request.status !== "rejected" || request.type !== "offer") {
          return res.json({
            code: "offer_not_rejected",
            message: "Une nouvelle offre est possible après le refus d’une offre.",
          }, 409);
        }

        const listing = await services.getListing(request.listingId);
        if (listingSellerId(listing) !== request.sellerId) {
          return res.json({
            code: "listing_not_available",
            message: "Cette annonce n’est plus disponible.",
          }, 409);
        }
        if (listing.status && listing.status !== "available") {
          return res.json({
            code: "listing_not_available",
            message: "Cette annonce n’est plus disponible.",
          }, 409);
        }

        const participants = [request.buyerId, request.sellerId];
        const offerMessages = (await services.listMessagesByRequest(requestId))
          .filter((message) => message.kind === "offer")
          .sort((left, right) => String(left.$createdAt || "").localeCompare(String(right.$createdAt || "")));
        let updatedRequest;
        const messages = await runTransaction(async (transactionId) => {
          const events = [];
          if (!offerMessages.length) {
            events.push(await services.createMessage({
              requestId,
              senderId: request.buyerId,
              content: `Offre : ${Number(request.amount)} €`,
              kind: "offer",
              amount: Number(request.amount),
              status: "rejected",
              participants,
              transactionId,
            }));
          }

          const lastOffer = offerMessages.at(-1);
          let nextOffer = lastOffer?.status === "pending" && Number(lastOffer.amount) === amount
            ? lastOffer
            : null;
          if (!nextOffer) {
            nextOffer = await services.createMessage({
              requestId,
              senderId: request.buyerId,
              content: `Offre : ${amount} €`,
              kind: "offer",
              amount,
              status: "pending",
              participants,
              transactionId,
            });
          }
          events.push(nextOffer);
          updatedRequest = await services.updateRequestOffer(requestId, {
            amount,
            status: "pending",
            lastMessage: nextOffer.content,
          }, transactionId);
          return events;
        });
        return res.json({ request: updatedRequest, messages });
      } catch (cause) {
        if (isTransactionConflict(cause)) {
          return res.json({
            code: "request_changed",
            message: "Cette demande vient d’être mise à jour. Actualisez la conversation avant de réessayer.",
          }, 409);
        }
        if (isNotFound(cause)) {
          return res.json({
            code: "conversation_not_found",
            message: "Cette conversation ou cette annonce n’est plus disponible.",
          }, 404);
        }
        error(`L’envoi d’une nouvelle offre a échoué (${cause instanceof Error ? cause.name : "UnknownError"}).`);
        return res.json({
          code: "internal_error",
          message: "La nouvelle offre n’a pas pu être envoyée. Réessayez.",
        }, 500);
      }
    }

    if (body.action !== "send-message") return invalidInput(res);
    const requestId = body.requestId;
    const content = typeof body.content === "string" ? body.content.trim() : "";
    if (
      typeof requestId !== "string"
      || !APPWRITE_ID_PATTERN.test(requestId)
      || !content
      || content.length > MAX_MESSAGE_LENGTH
    ) {
      return invalidInput(res);
    }

    try {
      const request = await services.getRequest(requestId);
      if (![request.buyerId, request.sellerId].includes(userId)) {
        return res.json({
          code: "not_participant",
          message: "Vous ne participez pas à cette conversation.",
        }, 403);
      }

      const message = await services.createMessage({
        requestId,
        senderId: userId,
        content,
        participants: [request.buyerId, request.sellerId],
      });
      const updatedRequest = await services.updateRequestLastMessage(requestId, content);
      return res.json({ message, request: updatedRequest });
    } catch (cause) {
      if (isNotFound(cause)) {
        return res.json({
          code: "conversation_not_found",
          message: "Cette conversation n’est plus disponible.",
        }, 404);
      }
      error(`L’envoi d’un message a échoué (${cause instanceof Error ? cause.name : "UnknownError"}).`);
      return res.json({
        code: "internal_error",
        message: "Le message n’a pas pu être envoyé. Réessayez.",
      }, 500);
    }
  };
}
