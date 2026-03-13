const liveSockets = new Map();

function setLiveSocket(userId, socketId) {
  liveSockets.set(userId, socketId);
}

function removeLiveSocket(socketId) {
  for (const [userId, value] of liveSockets.entries()) {
    if (value === socketId) liveSockets.delete(userId);
  }
}

function getSocketId(userId) {
  return liveSockets.get(userId);
}

module.exports = { setLiveSocket, removeLiveSocket, getSocketId };
