import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useParams, useLocation } from 'react-router-dom';
import io from 'socket.io-client';

const SOCKET_SERVER_URL = "https://studysync-final.onrender.com";
const socket = io(SOCKET_SERVER_URL);

// 1. Login / Entry Component
function Login() {
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [roomCode, setRoomCode] = useState('');

    const handleJoinRoom = (e) => {
        e.preventDefault();
        if (username.trim() && roomCode.trim()) {
            navigate(`/room/${roomCode}`, { state: { username } });
        } else {
            alert('Please enter both your name and room code!');
        }
    };

    return (
        <div style={{ textAlign: 'center', marginTop: '80px', fontFamily: 'Arial' }}>
            <h2>StudySync 2.0 - Collaborative Study Platform</h2>
            <form onSubmit={handleJoinRoom} style={{ display: 'inline-block', textAlign: 'left', background: '#f4f4f4', padding: '30px', borderRadius: '8px', boxShadow: '0 4px 8px rgba(0,0,0,0.1)' }}>
                <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Your Name:</label>
                    <input 
                        type="text" 
                        value={username} 
                        onChange={(e) => setUsername(e.target.value)} 
                        placeholder="Enter your name" 
                        style={{ padding: '10px', width: '280px', borderRadius: '4px', border: '1px solid #ccc' }}
                    />
                </div>
                <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Room Code:</label>
                    <input 
                        type="text" 
                        value={roomCode} 
                        onChange={(e) => setRoomCode(e.target.value)} 
                        placeholder="e.g. math-101" 
                        style={{ padding: '10px', width: '280px', borderRadius: '4px', border: '1px solid #ccc' }}
                    />
                </div>
                <button type="submit" style={{ padding: '12px 20px', background: '#007BFF', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', width: '100%', fontWeight: 'bold' }}>
                    Join Study Room
                </button>
            </form>
        </div>
    );
}

// 2. Room Component (Live Chat, Whiteboard, & File Upload Hub)
function Room() {
    const { roomCode } = useParams();
    const location = useLocation();
    const username = location.state?.username || "Guest";

    const [message, setMessage] = useState('');
    const [chatList, setChatList] = useState([]);

    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);

    useEffect(() => {
        socket.emit('join_room', roomCode);

        socket.on('receive_message', (data) => {
            setChatList((list) => [...list, data]);
        });

        socket.on('drawing', (data) => {
            drawOnCanvas(data.x0, data.y0, data.x1, data.y1, data.color, false);
        });

        return () => {
            socket.off('receive_message');
            socket.off('drawing');
        };
    }, [roomCode]);

    const sendMessage = (e) => {
        e.preventDefault();
        if (message.trim() !== '') {
            const messageData = {
                roomCode,
                sender: username,
                message,
                time: new Date().toLocaleTimeString()
            };
            socket.emit('send_message', messageData);
            setChatList((list) => [...list, messageData]);
            setMessage('');
        }
    };

    const handleFileUpload = async (e) => {
        const uploadedFile = e.target.files[0];
        if (!uploadedFile) return;

        const formData = new FormData();
        formData.append('file', uploadedFile);

        try {
            const response = await fetch(`${SOCKET_SERVER_URL}/api/upload`, {
                method: 'POST',
                body: formData,
            });
            const data = await response.json();
            
            if (data.fileUrl) {
                const fileMessage = {
                    roomCode,
                    sender: username,
                    message: `Shared a file: ${data.fileName}`,
                    fileUrl: data.fileUrl,
                    time: new Date().toLocaleTimeString()
                };
                socket.emit('send_message', fileMessage);
                setChatList((list) => [...list, fileMessage]);
            }
        } catch (err) {
            console.error('File upload failed:', err);
            alert('File upload failed!');
        }
    };

    const startDrawing = (e) => {
        setIsDrawing(true);
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        canvas.lastX = e.clientX - rect.left;
        canvas.lastY = e.clientY - rect.top;
    };

    const draw = (e) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        drawOnCanvas(canvas.lastX, canvas.lastY, x, y, '#000000', true);
        canvas.lastX = x;
        canvas.lastY = y;
    };

    const stopDrawing = () => {
        setIsDrawing(false);
    };

    const drawOnCanvas = (x0, y0, x1, y1, color, emit) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.closePath();

        if (!emit) return;
        socket.emit('drawing', { x0, y0, x1, y1, color, roomCode });
    };

    return (
        <div style={{ padding: '20px', fontFamily: 'Arial', display: 'flex', gap: '20px', height: '90vh', boxSizing: 'border-box' }}>
            {/* Left Box: Chat & Files */}
            <div style={{ flex: 1, border: '1px solid #ccc', padding: '15px', display: 'flex', flexDirection: 'column', borderRadius: '8px', background: '#fff' }}>
                <h3>Room: {roomCode}</h3>
                <p style={{ margin: '5px 0 15px 0', fontSize: '14px', color: '#555' }}>Logged in as: <b>{username}</b></p>
                <hr style={{ border: '0', borderTop: '1px solid #eee', marginBottom: '15px' }} />
                
                <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #eee', padding: '10px', marginBottom: '15px', background: '#f9f9f9', borderRadius: '4px' }}>
                    {chatList.map((msg, index) => (
                        <div key={index} style={{ marginBottom: '10px', fontSize: '14px' }}>
                            <strong>{msg.sender}: </strong>
                            <span>{msg.message}</span>
                            {msg.fileUrl && (
                                <div style={{ marginTop: '4px' }}>
                                    <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#007BFF', fontSize: '12px', textDecoration: 'none' }}>
                                        📥 Download Shared File
                                    </a>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                <div style={{ marginBottom: '10px' }}>
                    <label style={{ fontSize: '13px', cursor: 'pointer', background: '#e2e2e2', padding: '8px 12px', borderRadius: '4px', display: 'inline-block', fontWeight: 'bold' }}>
                        📁 Upload Document/PDF
                        <input type="file" onChange={handleFileUpload} style={{ display: 'none' }} />
                    </label>
                </div>

                <form onSubmit={sendMessage} style={{ display: 'flex', gap: '5px' }}>
                    <input 
                        type="text" 
                        value={message} 
                        onChange={(e) => setMessage(e.target.value)} 
                        placeholder="Type a message..." 
                        style={{ flex: 1, padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }}
                    />
                    <button type="submit" style={{ padding: '10px 15px', background: '#007BFF', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                        Send
                    </button>
                </form>
            </div>

            {/* Right Box: Whiteboard */}
            <div style={{ flex: 2, border: '1px solid #ccc', padding: '15px', display: 'flex', flexDirection: 'column', borderRadius: '8px', background: '#fff' }}>
                <h3>Collaborative Whiteboard</h3>
                <p style={{ margin: '5px 0 15px 0', fontSize: '14px', color: '#555' }}>Draw here and it will sync live with others in the room.</p>
                <div style={{ flex: 1, border: '1px solid #999', background: '#fff', cursor: 'crosshair', position: 'relative', borderRadius: '4px', overflow: 'hidden' }}>
                    <canvas 
                        ref={canvasRef}
                        width={700}
                        height={500}
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseOut={stopDrawing}
                        style={{ display: 'block', width: '100%', height: '100%' }}
                    />
                </div>
            </div>
        </div>
    );
}

// 3. Main App Routing Component
function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<Login />} />
                <Route path="/room/:roomCode" element={<Room />} />
            </Routes>
        </Router>
    );
}

export default App;