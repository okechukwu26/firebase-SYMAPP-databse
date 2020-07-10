const functions = require("firebase-functions");
const express = require("express");
const app = express();
const { db } = require("./Utills/admin");
const {
  getAllMinds,
  createMinds,
  getMind,
  commentOnMind,
  likeMind,
  unlikeMind,
  deleteMind,
} = require("./handles/Minds");
const {
  signUp,
  login,
  uploadImage,
  addUserDetails,
  getAuthenticatedUser,
  getUserDetails,
  markNotificationsRead,
} = require("./handles/User");
//auth middleware
const FBAuth = require("./Utills/FBAuth");
//init firebase

//Mind routes
app.get("/mind", getAllMinds);
app.post("/mind", FBAuth, createMinds);
app.get("/mind/:mindId", getMind);
app.post("/mind/:mindId/comments", FBAuth, commentOnMind);
app.get("/mind/:mindId/like", FBAuth, likeMind);
app.get("/mind/:mindId/unlike", FBAuth, unlikeMind);
app.delete("/mind/:mindId", FBAuth, deleteMind);

//users route
app.post("/signup", signUp);
app.post("/login", login);
app.post("/user/image", FBAuth, uploadImage);
app.post("/user", FBAuth, addUserDetails);
app.get("/user", FBAuth, getAuthenticatedUser);
app.get("/user/:handle", getUserDetails);
app.post("/notification", FBAuth, markNotificationsRead);

exports.api = functions.region("europe-west1").https.onRequest(app);

exports.createNotificationOnLike = functions
  .region("europe-west1")
  .firestore.document("likes/{id}")
  .onCreate((snapshot) => {
    return db
      .doc(`/Mind/${snapshot.data().mindId}`)
      .get()
      .then((doc) => {
        if (
          doc.exists &&
          doc.data().userHandle !== snapshot.data().userHandle
        ) {
          return db.doc(`/notifications/${snapshot.id}`).set({
            createdAt: new Date().toISOString(),
            recipient: doc.data().userHandle,
            sender: snapshot.data().userHandle,
            type: "like",
            read: false,
            mindId: doc.id,
          });
        }
      })

      .catch((err) => {});
  });
exports.deleteNotificationOnLike = functions
  .region("europe-west1")
  .firestore.document("likes/{id}")
  .onDelete((snapshot) => {
    return db
      .doc(`/notifications/${snapshot.id}`)
      .delete()

      .catch((err) => {
        return;
      });
  });
exports.createNotificationOnComment = functions
  .region("europe-west1")
  .firestore.document("comments/{id}")
  .onCreate((snapshot) => {
    return db
      .doc(`/Mind/${snapshot.data().mindId}`)
      .get()
      .then((doc) => {
        if (
          doc.exists &&
          doc.data().userHandle !== snapshot.data().userHandle
        ) {
          return db.doc(`/notifications/${snapshot.id}`).set({
            createdAt: new Date().toISOString(),
            recipient: doc.data().userHandle,
            sender: snapshot.data().userHandle,
            type: "comment",
            read: false,
            mindId: doc.id,
          });
        }
      })

      .catch((err) => {
        return;
      });
  });

exports.onUserImageChange = functions
  .region("europe-west1")
  .firestore.document("/users/{userId}")
  .onUpdate((change) => {
    if (change.before.data().imageUrl !== change.after.data().imageUrl) {
      const batch = db.batch();
      return db
        .collection("Mind")
        .where("userHandle", "==", change.before.data().handle)
        .get()
        .then((data) => {
          data.forEach((doc) => {
            const mind = db.doc(`/Mind/${doc.id}`);
            batch.update(mind, { userImage: change.after.data().imageUrl });
          });
          return batch.commit();
        });
    } else return true;
  });

exports.onMindDelete = functions
  .region("europe-west1")
  .firestore.document("/Mind/{mindId}")
  .onDelete((snapshot, context) => {
    const mindId = context.params.mindId;
    const batch = db.batch();
    return db
      .collection("comments")
      .where("mindId", "==", mindId)
      .get()
      .then((data) => {
        data.forEach((doc) => {
          batch.delete(db.doc(`/comments/${doc.id}`));
        });
        return db.collection("likes").where("mindId", "==", mindId).get();
      })
      .then((like) => {
        like.forEach((doc) => {
          batch.delete(db.doc(`/likes/${doc.id}`));
        });
        return db
          .collection("notifications")
          .where("mindId", "==", mindId)
          .get();
      })
      .then((data) => {
        data.forEach((doc) => {
          batch.delete(db.doc(`/notifications/${doc.id}`));
        });
        return batch.commit();
      })
      .catch((err) => {
        console.error(err);
      });
  });
