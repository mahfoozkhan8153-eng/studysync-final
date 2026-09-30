import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';

const socket = io();

function App() {
  const [username, setUsername] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [roomName, setRoomName] = useState('');
  const [currentRoom, setCurrentRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');

  useEffect(() => {
    socket.on('receive-message', (msg) => {
      setMessages((prev) => [...prev, msg]);
    });
    socket.on('load-room-data', (data) => {
      setMessages(data.messages || []);
    });
    return () => {
      socket.off('receive-message');
      socket.off('load-room-data');
    };
  }, []);

  const handleLogin = (e) => {
    e.preventDefault();
    if (username.trim()) setIsLoggedIn(true);
  };

  const createRoom = async () => {
    if (!roomName) return alert('Enter room name');
    const res = await fetch('/api/create-room', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomName, username })
    });
    const data = await res.json();
    if (data.success) joinRoomData(data.room);
  };

  const joinByCode = async () => {
    if (!roomCode) return alert('Enter room code');
    const res = await fetch('/api/join-by-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomCode })
    });
    const data = await res.json();
    if (data.success) joinRoomData(data.room);
    else alert(data.message);
  };

  const joinRoomData = (room) => {
    setCurrentRoom(room);
    socket.emit('join-room', { roomId: room.roomId, username });
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (!messageInput.trim()) return;
    socket.emit('send-message', { roomId: currentRoom.roomId, message: messageInput, username });
    setMessageInput('');
  };

  if (!isLoggedIn) {
    return (
      <div style={{ textAlign: 'center', marginTop: '100px', fontFamily: 'Arial' }}>
        <h2>StudySync 2.0 Login</h2>
        <form onSubmit={handleLogin}>
          <input type="text" placeholder="Your Name" value={username} onChange={(e) => setUsername(e.target.value)} style={{ padding: '10px' }} />
          <br/><br/>
          <button type="submit" style={{ padding: '10px 20px', background: '#007bff', color: '#fff', border: 'none' }}>Start</button>
        </form>
      </div>
    );
  }

  if (!currentRoom) {
    return (
      <div style={{ textAlign: 'center', marginTop: '50px', fontFamily: 'Arial' }}>
        <h2>Welcome, {username}</h2>
        <div>
          <h3>Create Room</h3>
          <input type="text" placeholder="Room Name" value={roomName} onChange={(e) => setRoomName(e.target.value)} style={{ padding: '8px' }} />
          <button onClick={createRoom} style={{ padding: '8px 15px', background: '#28a745', color: '#fff', border: 'none', marginLeft: '5px' }}>Create</button>
        </div>
        <hr style={{ width: '40%', margin: '20px auto' }}/>
        <div>
          <h3>Join Room</h3>
          <input type="text" placeholder="Room Code" value={roomCode} onChange={(e) => setRoomCode(e.target.value)} style={{ padding: '8px' }} />
          <button onClick={joinByCode} style={{ padding: '8px 15px', background: '#17a2b8', color: '#fff', border: 'none', marginLeft: '5px' }}>Join</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial' }}>
      <h2>Room: {currentRoom.roomName} (Code: {currentRoom.roomCode})</h2>
      <div style={{ border: '1px solid #ccc', padding: '15px', height: '350px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, overflowY: 'scroll', border: '1px solid #eee', padding: '10px', marginBottom: '10px' }}>
          {messages.map((m, i) => (
            <div key={i}><strong>{m.username}:</strong> {m.message}</div>
          ))}
        </div>
        <form onSubmit={sendMessage} style={{ display: 'flex' }}>
          <input type="text" value={messageInput} onChange={(e) => setMessageInput(e.target.value)} placeholder="Type message..." style={{ flex: 1, padding: '8px' }} />
          <button type="submit" style={{ padding: '8px 15px' }}>Send</button>
        </form>
      </div>
    </div>
  );
}

export default App;