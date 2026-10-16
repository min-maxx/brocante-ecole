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
        const request = await services.createRequest({ data, participants });
        let initialMessage;
        if (content) {
          try {
            initialMessage = await services.createMessage({
              requestId: request.$id,
              senderId: userId,
              content,
              participants,
            });
          } catch (cause) {
            try {
              await services.deleteRequest(request.$id);
            } catch (cleanupError) {
              error(`Impossible de supprimer la demande après l’échec du premier message (${cleanupError instanceof Error ? cleanupError.name : "UnknownError"}).`);
            }
            throw cause;
          }
        }
        return res.json({ request, messages: initialMessage ? [initialMessage] : [] }, 201);
      } catch (cause) {
        error(`La création d’une demande a échoué (${cause instanceof Error ? cause.name : "UnknownError"}).`);
        return res.json({
          code: "internal_error",
          message: "La demande n’a pas pu être envoyée. Réessayez.",
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
