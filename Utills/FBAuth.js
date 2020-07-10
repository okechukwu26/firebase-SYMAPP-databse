const { admin, db } = require("./admin");

const FBAuth = async (req, res, next) => {
  try {
    let idToken;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer ")
    ) {
      idToken = req.headers.authorization.split("Bearer ")[1];
    } else {
      return res.status(403).json({ error: "UnAuthorized" });
    }

    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken;
    const data = await db
      .collection("users")
      .where("userId", "==", req.user.uid)
      .limit(1)
      .get();
    req.user.handle = data.docs[0].data().handle;
    req.user.imageUrl = data.docs[0].data().imageUrl;
    return next();
  } catch (e) {
    console.log({ error: `error while verify token ${e}` });
    return res.status(403).json({ error: `error while verify token ${e}` });
  }
};
module.exports = FBAuth;
