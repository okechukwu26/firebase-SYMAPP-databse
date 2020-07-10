const { db } = require("../Utills/admin");

//all Minds
exports.getAllMinds = async (req, res) => {
  try {
    const data = await db.collection("Mind").orderBy("createdAt", "desc").get();
    let minds = [];
    data.forEach((doc) => {
      minds.push({
        mindId: doc.id,
        body: doc.data().body,
        userHandle: doc.data().userHandle,
        createdAt: doc.data().createdAt,
        commentCount: doc.data().commentCount,
        likeCount: doc.data().likeCount,
        userImage: doc.data().userImage,
      });
    });
    res.json(minds);
  } catch (e) {
    console.log(e);
    res.status(500).send(e);
  }
};

//create minds
exports.createMinds = async (req, res) => {
  try {
    const newMind = {
      body: req.body.body,
      userHandle: req.user.handle,
      userImage: req.user.imageUrl,
      createdAt: new Date().toISOString(),
      likeCount: 0,
      commentCount: 0,
    };
    const doc = await db.collection("Mind").add(newMind);
    const resMind = newMind;
    resMind.mindId = doc.id;
    res.json(resMind);
  } catch (e) {
    res.status(500).json({ message: "something went wrong" });
    console.error(e);
  }
};
//get mind
exports.getMind = async (req, res) => {
  try {
    let mindData = {};
    const doc = await db.doc(`/Mind/${req.params.mindId}`).get();
    if (!doc.exists) {
      return res.status(400).json({ error: "mind not found" });
    }
    mindData = doc.data();
    mindData.mindId = doc.id;
    const data = await db
      .collection("comments")
      .orderBy("createdAt", "desc")
      .where("mindId", "==", req.params.mindId)
      .get();
    mindData.comments = [];
    data.forEach((doc) => {
      mindData.comments.push(doc.data());
    });
    return res.json(mindData);
  } catch (err) {
    return res.status(500).json({ error: err.code });
  }
};

//comment on comment
exports.commentOnMind = async (req, res) => {
  try {
    if (req.body.body === "")
      return res.status(400).json({ comment: "Must Not be empty" });
    const newComment = {
      body: req.body.body,
      userHandle: req.user.handle,
      mindId: req.params.mindId,
      createdAt: new Date().toISOString(),
      userImage: req.user.imageUrl,
    };
    const doc = await db.doc(`/Mind/${req.params.mindId}`).get();
    if (!doc.exists) {
      return res.status(400).json({ error: "not found" });
    }
    await doc.ref.update({ commentCount: doc.data().commentCount + 1 });
    await db.collection("comments").add(newComment);
    res.json(newComment);
  } catch (e) {
    res.status(500).json({ error: "something went wrong" });
  }
};
//like mind
exports.likeMind = async (req, res) => {
  try {
    const likeDocument = db
      .collection("likes")
      .where("userHandle", "==", req.user.handle)
      .where("mindId", "==", req.params.mindId)
      .limit(1);
    const mindDocument = db.doc(`/Mind/${req.params.mindId}`);
    let mindData;
    const mindDoc = await mindDocument.get();
    if (!mindDoc.exists) {
      return res.status(404).json({ error: "Mind not found" });
    }
    mindData = mindDoc.data();
    mindData.mindId = mindDoc.id;
    const likeDoc = await likeDocument.get();
    if (likeDoc.empty) {
      await db.collection("likes").add({
        mindId: req.params.mindId,
        userHandle: req.user.handle,
      });
      mindData.likeCount++;
      await mindDocument.update({ likeCount: mindData.likeCount });
      return res.json(mindData);
    } else {
      return res.status(400).json({ error: "mind already liked" });
    }
  } catch (err) {
    return res.status(500).json({ error: err.code });
  }
};
//unlike mind
exports.unlikeMind = async (req, res) => {
  try {
    const likeDocument = db
      .collection("likes")
      .where("userHandle", "==", req.user.handle)
      .where("mindId", "==", req.params.mindId)
      .limit(1);
    const mindDocument = db.doc(`/Mind/${req.params.mindId}`);
    let mindData;
    const mindDoc = await mindDocument.get();
    if (!mindDoc.exists) {
      return res.status(404).json({ error: "Mind not found" });
    }
    mindData = mindDoc.data();
    mindData.mindId = mindDoc.id;
    const likeDoc = await likeDocument.get();
    if (likeDoc.empty) {
      return res.status(400).json({ error: "mind not liked" });
    } else {
      await db.doc(`/likes/${likeDoc.docs[0].id}`).delete();
      mindData.likeCount--;
      await mindDocument.update({ likeCount: mindData.likeCount });
      return res.json(mindData);
    }
  } catch (err) {
    return res.status(500).json({ error: err.code });
  }
};

//delete mind
exports.deleteMind = (req, res) => {
  const document = db.doc(`/Mind/${req.params.mindId}`);
  document
    .get()
    .then((doc) => {
      if (!doc.exists) {
        return res.status(404).json({ error: "mind not found" });
      }
      if (doc.data().userHandle !== req.user.handle) {
        res.status(403).json({ error: "UnAuthorized" });
      } else {
        document.delete();
      }
    })
    .then(() => {
      res.json({ message: "Mind deleted successfully" });
    })
    .catch((err) => {
      return res.status(500).json({ error: err.code });
    });
};
