const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
// exports.helloWorld = functions.https.onRequest((request, response) => {
//  response.send("Hello from Firebase!");
// });

// WHEN DEPLOYING FUNCTIONS USE THE FOLLOWING COMMAND
// firebase deploy --only functions

exports.onCreateFollower = functions.firestore
    .document("/followers/{userId}/userFollowers/{followerId}")
    .onCreate(async (snapshot, context) => {
        console.log("follower Created ", snapshot.id);
        const userId = context.params.userId;
        const followerId = context.params.followerId;

        // 1 - Get followed users posts
        const followedUserRef = admin
            .firestore()
            .collection('posts')
            .doc(userId)
            .collection('userPosts');

        // 2 - Get following user's timeline
        const timelinePostsRef = admin
            .firestore()
            .collection('timeline')
            .doc(followerId)
            .collection('timelinePosts');

        // 3 - Get posts
        const querySnapshot = await followedUserRef.get();

        // 4 - Add each post to following user timeline
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
        console.log("follower Deleted ", snapshot.id);
        const userId = context.params.userId;
        const followerId = context.params.followerId;


        const timelinePostsRef = admin
            .firestore()
            .collection('timeline')
            .doc(followerId)
            .collection('timelinePosts')
            .where('ownerId', '==', userId);


        // 3 - Get posts
        const querySnapshot = await timelinePostsRef.get();

        // 4 - Add each post to following user timeline
        querySnapshot.forEach(doc => {
            if (doc.exists) {
                doc.ref.delete();
            }
        });
    });