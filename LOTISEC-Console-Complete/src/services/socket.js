import { io } from 'socket.io-client'

let socket
export function getSocket() {
  if (!socket) {
    const url = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000'
    socket = io(url, { autoConnect: false, transports:['websocket','polling'] })
  }
  return socket
}
