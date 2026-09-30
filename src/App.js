import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';

const BACKEND_URL = 'https://studysync-final.onrender.com';
let socket;

export default function App() {
  const [view, setView] = useState('auth');
  const [authMode, setAuthMode] = useState('login');
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');

  const [roomTitleInput, setRoomTitleInput] = useState('');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [activeRooms, setActiveRooms] = useState([]);
  const [createdRoomInfo, setCreatedRoomInfo] = useState(null);

  const [currentRoom, setCurrentRoom] = useState(null);
  const [activeTab, setActiveTab] = useState('chat');
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [filesList, setFilesList] = useState([]);

  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    socket = io(BACKEND_URL);
    fetchRooms();

    socket.on('receive_message', (data) => {
      setMessages((prev) => [...prev, data]);
    });

    socket.on('load_history_messages', (history) => {
      setMessages(history);
    });

    // Room join karte hi purani saari uploaded files yahan load hongi
    socket.on('load_history_files', (files) => {
      setFilesList(files);
    });

    // Agar koi live file upload karega toh yahan turant list mein add ho jayegi
    socket.on('receive_file', (file) => {
      setFilesList((prev) => {
        // Duplicate entry se bachne ke liye check
        if (!prev.some(f => f.url === file.url)) {
          return [...prev, file];
        }
        return prev;
      });
    });

    socket.on('drawing', (data) => {
      drawOnCanvas(data.x0, data.y0, data.x1, data.y1, data.color, false);
    });

    return () => {
      if (socket) socket.disconnect();
    };
  }, []);

  const fetchRooms = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/rooms`);
      const data = await res.json();
      if (Array.isArray(data)) setActiveRooms(data);
    } catch (err) {
      console.error('Error fetching rooms:', err);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');
      setAuthSuccess('Account created successfully! Please sign in.');
      setAuthMode('login');
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Invalid credentials');
      setCurrentUser({ name: data.name, email: data.email });
      setView('dashboard');
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    if (!roomTitleInput.trim()) return;
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase().slice(0, 6) + Math.floor(100 + Math.random() * 900);
    const roomData = {
      className: roomTitleInput,
      roomCode: roomCode,
      createdBy: currentUser?.name || 'Admin'
    };

    try {
      const res = await fetch(`${BACKEND_URL}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(roomData)
      });
      const data = await res.json();
      if (res.ok) {
        setCreatedRoomInfo(data);
        setRoomTitleInput('');
        fetchRooms();
      }
    } catch (err) {
      console.error('Error creating room:', err);
    }
  };

  const joinRoomObj = (room) => {
    setCurrentRoom(room);
    socket.emit('join_room', room.roomCode);
    setView('room');
    setMessages([]);
    setFilesList([]);
  };

  const handleJoinByCode = (e) => {
    e.preventDefault();
    const found = activeRooms.find(r => r.roomCode.toLowerCase() === joinCodeInput.trim().toLowerCase());
    if (found) {
      joinRoomObj(found);
      setJoinCodeInput('');
    } else {
      alert('Invalid Room Code or Room not found!');
    }
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (!messageInput.trim()) return;
    const msgData = {
      roomCode: currentRoom?.roomCode,
      sender: currentUser?.name || 'User',
      text: messageInput,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    socket.emit('send_message', msgData);
    setMessageInput('');
  };

  // Fixed File Upload with Room-wise Socket Emission
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!currentRoom || !currentRoom.roomCode) {
      alert('Room error: Please rejoin the room.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${BACKEND_URL}/api/upload`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        const fileObj = { name: data.fileName, url: data.fileUrl };
        setFilesList(prev => [...prev, fileObj]);
        
        // Backend par file event emit karna taaki baaki users aur history mein save ho jaye
        socket.emit('upload_file_event', {
          roomCode: currentRoom.roomCode,
          fileData: fileObj
        });
      }
    } catch (err) {
      console.error('File upload failed:', err);
    }
  };

  const drawOnCanvas = (x0, y0, x1, y1, color, emit) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.closePath();

    if (!emit) return;
    socket.emit('drawing', {
      x0, y0, x1, y1, color, roomCode: currentRoom?.roomCode
    });
  };

  if (view === 'auth') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full bg-slate-900 border border-amber-500/30 rounded-2xl p-8 shadow-2xl">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-extrabold tracking-tight text-amber-400">StudySync</h1>
            <p className="text-sm text-slate-400 mt-1">Virtual Collaborative Learning Environment</p>
          </div>

          <div className="flex bg-slate-950 p-1 rounded-xl mb-6 border border-slate-800">
            <button
              onClick={() => { setAuthMode('login'); setAuthError(''); setAuthSuccess(''); }}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${authMode === 'login' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'}`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setAuthMode('register'); setAuthError(''); setAuthSuccess(''); }}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${authMode === 'register' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'}`}
            >
              Register
            </button>
          </div>

          {authError && <div className="mb-4 p-3 bg-red-950/50 border border-red-500 text-red-200 text-xs rounded-xl">{authError}</div>}
          {authSuccess && <div className="mb-4 p-3 bg-emerald-950/50 border border-emerald-500 text-emerald-200 text-xs rounded-xl">{authSuccess}</div>}

          <form onSubmit={authMode === 'register' ? handleRegister : handleLogin} className="space-y-4">
            {authMode === 'register' && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="Enter your full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Email Address</label>
              <input
                type="email"
                required
                placeholder="name@university.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Password</label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100"
              />
            </div>
            <button
              type="submit"
              className="w-full mt-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-3 rounded-xl uppercase text-sm"
            >
              {authMode === 'register' ? 'Create Account' : 'Access Dashboard'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (view === 'dashboard') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-8 font-sans">
        <div className="max-w-5xl mx-auto space-y-8">
          <header className="flex justify-between items-center bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
            <div>
              <h2 className="text-2xl font-bold text-amber-400">Welcome back, {currentUser?.name}!</h2>
              <p className="text-sm text-slate-400 mt-0.5">Manage your study rooms or join existing collaborative hubs.</p>
            </div>
            <button
              onClick={() => { setCurrentUser(null); setView('auth'); }}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-semibold rounded-xl border border-slate-700"
            >
              Sign Out
            </button>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400">Create Study Room</h3>
              <form onSubmit={handleCreateRoom} className="space-y-4">
                <input
                  type="text"
                  required
                  placeholder="Room Title (e.g., Data Structures Hub)"
                  value={roomTitleInput}
                  onChange={(e) => setRoomTitleInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100"
                />
                <button type="submit" className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-3 rounded-xl text-sm">
                  Initialize Room
                </button>
              </form>
              {createdRoomInfo && (
                <div className="p-4 bg-amber-950/30 border border-amber-500/50 rounded-xl space-y-2">
                  <p className="text-xs text-amber-300 font-semibold">Room Created Successfully!</p>
                  <div className="text-xl font-mono tracking-widest text-amber-400 font-bold">{createdRoomInfo.roomCode}</div>
                  <button onClick={() => joinRoomObj(createdRoomInfo)} className="w-full py-2 bg-amber-500 text-slate-950 text-xs font-bold rounded-lg">
                    Enter Now
                  </button>
                </div>
              )}
            </div>

            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400">Join Via Room Code</h3>
              <form onSubmit={handleJoinByCode} className="space-y-4">
                <input
                  type="text"
                  required
                  placeholder="ENTER CODE (E.g., ABC123)"
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm font-mono uppercase text-slate-100"
                />
                <button type="submit" className="w-full bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold py-3 rounded-xl border border-amber-500/30 text-sm">
                  Join Hub
                </button>
              </form>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Active Collaboration Rooms ({activeRooms.length})</h3>
            {activeRooms.length === 0 ? (
              <p className="text-xs text-slate-500 py-4">No active study rooms available right now. Create one above!</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {activeRooms.map((room) => (
                  <div key={room._id} className="bg-slate-950 border border-slate-800 p-4 rounded-xl flex flex-col justify-between space-y-3">
                    <div>
                      <h4 className="font-bold text-slate-200 text-base">{room.className}</h4>
                      <p className="text-xs text-slate-400 mt-1">Host: {room.createdBy}</p>
                      <span className="inline-block mt-2 font-mono text-xs bg-amber-500/10 text-amber-400 px-2 py-1 rounded border border-amber-500/20">{room.roomCode}</span>
                    </div>
                    <button
                      onClick={() => joinRoomObj(room)}
                      className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold rounded-lg transition-all"
                    >
                      Join
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans h-screen overflow-hidden">
      <header className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex flex-wrap justify-between items-center gap-2">
        <div className="flex items-center space-x-3">
          <button onClick={() => setView('dashboard')} className="px-3 py-1.5 bg-slate-800 text-amber-400 text-xs font-semibold rounded-lg">
            Exit Room
          </button>
          <div className="text-sm font-bold text-slate-200">Room: <span className="text-amber-400">{currentRoom?.className}</span></div>
          <div className="font-mono text-xs bg-amber-500/10 text-amber-400 px-2.5 py-1 rounded-lg border border-amber-500/20 font-bold">{currentRoom?.roomCode}</div>
        </div>
        <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 overflow-x-auto">
          {['chat', 'whiteboard', 'files', 'quiz', 'leaderboard'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg capitalize transition-all ${activeTab === tab ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
            >
              {tab === 'quiz' ? 'Quiz Hub' : tab}
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 overflow-hidden p-4">
        {activeTab === 'chat' && (
          <div className="h-full flex flex-col bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden max-w-4xl mx-auto">
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-500 text-xs">No messages yet. Start the conversation!</div>
              ) : (
                messages.map((m, idx) => (
                  <div key={idx} className={`flex flex-col ${m.sender === currentUser?.name ? 'items-end' : 'items-start'}`}>
                    <span className="text-[10px] text-slate-500 mb-0.5">{m.sender} • {m.time}</span>
                    <div className={`p-3 rounded-2xl text-xs max-w-sm ${m.sender === currentUser?.name ? 'bg-amber-500 text-slate-950 rounded-br-none' : 'bg-slate-800 text-slate-200 rounded-bl-none'}`}>
                      {m.text}
                    </div>
                  </div>
                ))
              )}
            </div>
            <form onSubmit={sendMessage} className="p-3 bg-slate-950 border-t border-slate-800 flex gap-2">
              <input
                type="text"
                placeholder="Type a message..."
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100"
              />
              <button type="submit" className="px-5 bg-amber-500 text-slate-950 font-bold text-xs rounded-xl">Send</button>
            </form>
          </div>
        )}

        {activeTab === 'whiteboard' && (
          <div className="h-full flex flex-col bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden max-w-5xl mx-auto">
            <div className="px-4 py-2 bg-slate-950 border-b border-slate-800 flex justify-between items-center text-xs text-amber-400 font-bold">
              <span>Interactive Whiteboard (Live Sync)</span>
              <div className="flex space-x-2">
                {['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#ffffff'].map((c) => (
                  <div key={c} onClick={() => window.activeColor = c} className="w-5 h-5 rounded-full border border-slate-700 cursor-pointer" style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
            <div className="flex-1 bg-white relative overflow-hidden">
              <canvas
                ref={canvasRef}
                width={1000}
                height={600}
                className="w-full h-full cursor-crosshair touch-none"
                onMouseDown={(e) => {
                  setIsDrawing(true);
                  const rect = e.target.getBoundingClientRect();
                  window.lastX = e.clientX - rect.left;
                  window.lastY = e.clientY - rect.top;
                }}
                onMouseUp={() => setIsDrawing(false)}
                onMouseMove={(e) => {
                  if (!isDrawing) return;
                  const rect = e.target.getBoundingClientRect();
                  const x = e.clientX - rect.left;
                  const y = e.clientY - rect.top;
                  drawOnCanvas(window.lastX, window.lastY, x, y, window.activeColor || '#f59e0b', true);
                  window.lastX = x;
                  window.lastY = y;
                }}
              />
            </div>
          </div>
        )}

        {activeTab === 'files' && (
          <div className="h-full flex flex-col bg-slate-900 border border-slate-800 rounded-2xl shadow-xl p-6 max-w-4xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-amber-400">Workspace Shared Files</h3>
                <p className="text-xs text-slate-400 mt-0.5">Upload and download group resources securely from cloud storage.</p>
              </div>
              <label className="cursor-pointer bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-4 py-2.5 rounded-xl text-xs transition-all shadow-md">
                Upload File
                <input type="file" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2">
              {filesList.length === 0 ? (
                <div className="h-40 flex items-center justify-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">No files uploaded yet. Be the first to share resources!</div>
              ) : (
                filesList.files?.map ? null : filesList.map((f, i) => (
                  <div key={i} className="flex justify-between items-center bg-slate-950 p-4 rounded-xl border border-slate-800">
                    <span className="text-xs font-semibold text-slate-200">{f.name}</span>
                    <a href={f.url} target="_blank" rel="noreferrer" className="px-3 py-1.5 bg-amber-500/10 text-amber-400 hover:bg-amber-500 hover:text-slate-950 text-xs font-bold rounded-lg border border-amber-500/20 transition-all">
                      Download
                    </a>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'quiz' && (
          <div className="h-full flex flex-col bg-slate-900 border border-slate-800 rounded-2xl shadow-xl p-6 max-w-4xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-amber-400">Live Quiz Challenge Hub</h3>
                <p className="text-xs text-slate-400 mt-0.5">Test your knowledge with real-time peer quizzes.</p>
              </div>
            </div>
            <div className="flex-1 flex items-center justify-center border border-dashed border-slate-800 rounded-xl">
              <p className="text-xs text-slate-500">No active quiz running in this room right now.</p>
            </div>
          </div>
        )}

        {activeTab === 'leaderboard' && (
          <div className="h-full flex flex-col bg-slate-900 border border-slate-800 rounded-2xl shadow-xl p-6 max-w-4xl mx-auto space-y-6">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-amber-400">Room Leaderboard</h3>
              <p className="text-xs text-slate-400 mt-0.5">Top scorers based on correct quiz submissions in this room.</p>
            </div>
            <div className="flex-1 flex items-center justify-center border border-dashed border-slate-800 rounded-xl">
              <p className="text-xs text-slate-500">No scores recorded yet. Participate in quizzes to score points!</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}