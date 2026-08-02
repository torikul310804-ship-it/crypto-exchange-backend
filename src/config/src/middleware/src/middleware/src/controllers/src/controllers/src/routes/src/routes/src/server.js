require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1', adminRoutes);

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Exchange Server running on port ${PORT}`));
