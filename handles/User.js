const validator = require("validator");
const { admin, db } = require("../Utills/admin");
const config = require("../Utills/config.js");
const { isEmpty, reduceUserDetail } = require("../Utills/validators");

const firebase = require("firebase");
firebase.initializeApp(config);
//signup
exports.signUp = async (req, res) => {
  try {
    const newUser = {
      email: req.body.email,
      password: req.body.password,
      confirmPassword: req.body.confirmPassword,
      handle: req.body.handle,
    };
    let errors = {};
    if (isEmpty(newUser.email)) {
      errors.email = "Must not be empty";
    } else if (!validator.isEmail(newUser.email)) {
      errors.email = "Must be valid email";
    }

    if (isEmpty(newUser.password)) {
      errors.password = "Must not be empty";
    }
    if (newUser.password.length < 6) {
      errors.password = "Too weak (password lenght must be  more than 6)";
    }
    if (newUser.password !== newUser.confirmPassword) {
      errors.confirmPassword = "password do not match";
    }
    if (isEmpty(newUser.handle)) {
      errors.handle = "Must not be empty";
    }
    if (Object.keys(errors).length > 0) {
      return res.status(400).json(errors);
    }
    const image = "no-img.png";
    let token, userId;
    const doc = await db.doc(`/users/${newUser.handle}`).get();
    if (doc.exists) {
      return res.status(400).json({ handle: "handle already in use" });
    } else {
      const data = await firebase
        .auth()
        .createUserWithEmailAndPassword(newUser.email, newUser.password);
      userId = data.user.uid;
      const idToken = await data.user.getIdToken();
      token = idToken;
      const userCredential = {
        handle: newUser.handle,
        email: newUser.email,
        createdAt: new Date().toISOString(),
        imageUrl: `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${image}?alt=media`,
        userId,
      };
      await db.doc(`/users/${newUser.handle}`).set(userCredential);
      res.status(201).json({ token });
    }
  } catch (err) {
    console.error(err);
    if (err.code === "auth/email-already-in-use") {
      return res.status(400).json({ email: "email already in use" });
    } else {
      res.status(500).json({ general: "something went wrong" });
    }
  }
};
//login
exports.login = async (req, res) => {
  try {
    const newUser = {
      email: req.body.email,
      password: req.body.password,
    };
    let errors = {};
    if (isEmpty(newUser.email)) {
      errors.email = " Must not be empty";
    }
    if (isEmpty(newUser.password)) {
      errors.password = " Must not be empty";
    }
    if (!validator.isEmail(newUser.email)) {
      errors.email = "Must be a valid email";
    }
    if (Object.keys(errors).length > 0) {
      return res.status(400).json(errors);
    }
    const data = await firebase
      .auth()
      .signInWithEmailAndPassword(newUser.email, newUser.password);
    const idToken = await data.user.getIdToken();
    return res.json({ idToken });
  } catch (err) {
    console.log(err);

    return res
      .status(403)
      .json({ general: "wrong credentials please try again" });
  }
};
//upload profile image
exports.uploadImage = (req, res) => {
  const BusBoy = require("busboy");
  const path = require("path");
  const os = require("os");
  const fs = require("fs");
  const busboy = new BusBoy({ headers: req.headers });
  let imageFileName;
  let imageToBeUploaded = {};
  busboy.on("file", (fieldname, file, filename, encoding, mimetype) => {
    if (mimetype !== "image/jpeg" && mimetype !== "image/png") {
      return res.status(400).json({ error: "wrong file type submitted" });
    }
    const imageExtension = filename.split(".")[filename.split(".").length - 1];
    imageFileName = `${Math.round(
      Math.random() * 100000000
    )}.${imageExtension}`;
    const filepath = path.join(os.tmpdir(), imageFileName);
    imageToBeUploaded = { filepath, mimetype };
    file.pipe(fs.createWriteStream(filepath));
  });
  busboy.on("finish", () => {
    admin
      .storage()
      .bucket()
      .upload(imageToBeUploaded.filepath, {
        resumable: false,
        metadata: {
          metadata: {
            contentType: imageToBeUploaded.mimetype,
          },
        },
      })
      .then(() => {
        const imageUrl = `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${imageFileName}?alt=media`;
        return db.doc(`/users/${req.user.handle}`).update({ imageUrl });
      })
      .then(() => {
        return res.json({ message: "image uploaded successfully" });
      })
      .catch((err) => {
        res.status(500).json({ erro: err.code });
      });
  });
  busboy.end(req.rawBody);
};

//user Detail

exports.addUserDetails = async (req, res) => {
  try {
    let userDetail = reduceUserDetail(req.body);
    db.doc(`/users/${req.user.handle}`).update(userDetail);
    res.json({ message: "Details uploaded successfully" });
  } catch (e) {
    res.status(500).json({ error: e.code });
  }
};
// get any user
exports.getUserDetails = (req, res) => {
  let userData = {};
  db.doc(`/users/${req.params.handle}`)
    .get()
    .then((user) => {
      if (user.exists) {
        userData.user = user.data();
        return db
          .collection("Mind")
          .where("userHandle", "==", req.params.handle)
          .orderBy("createdAt", "desc")
          .get();
      } else {
        return res.status(404).json({ error: "user not found" });
      }
    })
    .then((data) => {
      userData.minds = [];
      data.forEach((doc) => {
        userData.minds.push({
          body: doc.data().body,
          createdAt: doc.data().createdAt,
          userHandle: doc.data().userHandle,
          userImage: doc.data().userImage,
          likeCount: doc.data().likeCount,
          commentCount: doc.data().commentCount,
          mindId: doc.id,
        });
      });
      return res.json(userData);
    })
    .catch((err) => {
      res.status(500).json({ error: err.code });
    });
};

//get authenticated user

exports.getAuthenticatedUser = async (req, res) => {
  try {
    let userData = {};
    const user = await db.doc(`/users/${req.user.handle}`).get();
    if (user.exists) {
      userData.credential = user.data();
      const data = await db
        .collection("likes")
        .where("userHandle", "==", req.user.handle)
        .get();
      userData.likes = [];
      data.forEach((doc) => {
        userData.likes.push(doc.data());
      });
    }
    const notify = await db
      .collection("notifications")
      .where("recipient", "==", req.user.handle)
      .orderBy("createdAt", "desc")
      .limit(10)
      .get();
    userData.notifications = [];
    notify.forEach((notif) => {
      userData.notifications.push({
        recipient: notif.data().recipient,
        sender: notif.data().sender,
        createdAt: notif.data().createdAt,
        type: notif.data().type,
        read: notif.data().read,
        notificationId: notif.id,
        mindId: notif.data().mindId,
      });
    });

    return res.json(userData);
  } catch (e) {
    res.status(500).json({ error: err.code });
  }
};

exports.markNotificationsRead = (req, res) => {
  let batch = db.batch();
  req.body.forEach((notificationId) => {
    const notification = db.doc(`/notifications/${notificationId}`);
    batch.update(notification, { read: true });
  });
  batch
    .commit()
    .then(() => {
      return res.json({ message: "notification read successfully" });
    })
    .catch((err) => {
      return res.status(500).json({ error: err.code });
    });
};
