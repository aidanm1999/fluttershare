const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
// exports.helloWorld = functions.https.onRequest((request, response) => {
//  response.send("Hello from Firebase!");
// });
exports.onCreateFollower = functions.firestore
    .document("/followers/{userId}/userFollowers/{followerId}")
    .onCreate(async (snapshot, context) => {
        console.log("Follower Created", snapshot.id);
        const userId = context.params.userId;
        const followerId = context.params.followerId;

        // 1) Create followed users posts ref
        const followedUserPostsRef = admin
            .firestore()
            .collection("posts")
            .doc(userId)
            .collection("userPosts");

        // 2) Create following user's timeline ref
        const timelinePostsRef = admin
            .firestore()
            .collection("timeline")
            .doc(followerId)
            .collection("timelinePosts");

        // 3) Get followed users posts
        const querySnapshot = await followedUserPostsRef.get();

        // 4) Add each user post to following user's timeline
        querySnapshot.forEach(doc => {
            if (doc.exists) {
                const postId = doc.id;
                const postData = doc.data();
                timelinePostsRef.doc(postId).set(postData);
            }
        });
    });

exports.onDeleteFollower = functions.firestore
    .document("/followers/{userId}/userFollowers/{followerId}")
    .onDelete(async (snapshot, context) => {
        console.log("Follower Deleted", snapshot.id);

        const userId = context.params.userId;
        const followerId = context.params.followerId;

        const timelinePostsRef = admin
            .firestore()
            .collection("timeline")
            .doc(followerId)
            .collection("timelinePosts")
            .where("ownerId", "==", userId);

        const querySnapshot = await timelinePostsRef.get();
        querySnapshot.forEach(doc => {
            if (doc.exists) {
                doc.ref.delete();
            }
        });
    });

// when a post is created, add post to timeline of each follower (of post owner)
exports.onCreatePost = functions.firestore
    .document("/posts/{userId}/userPosts/{postId}")
    .onCreate(async (snapshot, context) => {
        const postCreated = snapshot.data();
        const userId = context.params.userId;
        const postId = context.params.postId;

        // 1) Get all the followers of the user who made the post
        const userFollowersRef = admin
            .firestore()
            .collection("followers")
            .doc(userId)
            .collection("userFollowers");

        const querySnapshot = await userFollowersRef.get();
        // 2) Add new post to each follower's timeline
        querySnapshot.forEach(doc => {
            const followerId = doc.id;

            admin
                .firestore()
                .collection("timeline")
                .doc(followerId)
                .collection("timelinePosts")
                .doc(postId)
                .set(postCreated);
        });
    });

exports.onUpdatePost = functions.firestore
    .document("/posts/{userId}/userPosts/{postId}")
    .onUpdate(async (change, context) => {
        const postUpdated = change.after.data();
        const userId = context.params.userId;
        const postId = context.params.postId;

        // 1) Get all the followers of the user who made the post
        const userFollowersRef = admin
            .firestore()
            .collection("followers")
            .doc(userId)
            .collection("userFollowers");

        const querySnapshot = await userFollowersRef.get();
        // 2) Update each post in each follower's timeline
        querySnapshot.forEach(doc => {
            const followerId = doc.id;

            admin
                .firestore()
                .collection("timeline")
                .doc(followerId)
                .collection("timelinePosts")
                .doc(postId)
                .get()
                .then(doc => {
                    if (doc.exists) {
                        doc.ref.update(postUpdated);
                    }
                    return null;
                }).catch(error => {
                    console.error(error);
                    res.error(500);
                });
        });
    });

exports.onDeletePost = functions.firestore
    .document("/posts/{userId}/userPosts/{postId}")
    .onDelete(async (snapshot, context) => {
        const userId = context.params.userId;
        const postId = context.params.postId;



        // 1) Get all the followers of the user who made the post
        const userFollowersRef = admin
            .firestore()
            .collection("followers")
            .doc(userId)
            .collection("userFollowers");

        const querySnapshot = await userFollowersRef.get();
        // 2) Delete each post in each follower's timeline
        querySnapshot.forEach(async doc => {
            const followerId = doc.id;

            admin
                .firestore()
                .collection("timeline")
                .doc(followerId)
                .collection("timelinePosts")
                .doc(postId)
                .get()
                .then(doc => {
                    if (doc.exists) {
                        doc.ref.delete();
                    }
                    return null;
                }).catch(error => {
                    console.error(error);
                    res.error(500);
                });
        });
    });


exports.onCreateActivityFeedItem = functions.firestore
    .document('/feed/{userId}/feedItems/{activityFeedItem}')
    .onCreate(async (snapshot, context) => {
        console.log('Activity Feed Item Created ', snapshot.data());

        //Get User connected to feed
        const userId = context.params.userId;
        const userRef = admin.firestore().doc(`users/${userId}`);
        const doc = await userRef.get();

        //Check if have a notification document
        const androidNotificationToken = doc.data().androidNotificationToken;
        if (androidNotificationToken) {
            sendNotification(androidNotificationToken, snapshot.data());
        } else {
            console.log('No android notification token');
        }

        function sendNotification(androidNotificationToken, activityFeedItem) {
            let body;

            //switch body val based off of notification type
            switch (activityFeedItem.type) {
                case "comment":
                    body = `${activityFeedItem.username} replied ${activityFeedItem.commentData}`;
                    console.log('comment HIT by -', activityFeedItem.username);
                    break;
                case "like":
                    body = `${activityFeedItem.username} liked your post`;

                    console.log('like HIT by -', activityFeedItem.username);
                    break;
                case "follow":
                    body = `${activityFeedItem.username} started following you`;

                    console.log('follow HIT by -', activityFeedItem.username);
                    break;

                default:
                    break;
            }

            //Create messahe for notification
            const message = {
                notification: { body },
                token: androidNotificationToken,
                data: { recipient: doc.data().id },
            };

            console.log("Message - ", message);

            //Send message with admin messaging
            //'response' is a message id string

            console.log(admin.messaging);

            admin.messaging().send(message).then(response => {
                console.log("Successfully sent message", response);
                return '';
            }).catch(error => {
                console.log("Error Sending message", error);
            });
        }

    });