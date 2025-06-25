# Chat99 - Random Stranger Chat Platform

A modern, real-time stranger chat platform similar to ChatIB with enhanced features and better user experience.

## 🚀 Features

- **Guest Chat**: No registration required - jump straight into conversations
- **Gender Filters**: Choose who you want to chat with
- **Real-time Messaging**: Instant message delivery using WebSockets
- **Image Sharing**: Share photos during conversations
- **Message Rate Limiting**: Prevents spam (max 2 messages until reply)
- **Mobile Responsive**: Works perfectly on all devices
- **Modern UI**: Clean, intuitive interface

## 🛠️ Tech Stack

### Backend
- **Node.js** + **Express** - Server framework
- **Socket.io** - Real-time WebSocket communication
- **MongoDB** - Database for users and messages
- **JWT** - Authentication tokens
- **Multer** + **Cloudinary** - Image upload and storage

### Frontend
- **Vanilla JavaScript** - No framework dependencies
- **HTML5** + **CSS3** - Modern responsive design
- **Socket.io Client** - Real-time communication

### Free Services Used
- **MongoDB Atlas** - Free database hosting
- **Cloudinary** - Free image storage (10GB)
- **Render.com** - Free web hosting
- **GitHub** - Source code hosting

## 📦 Installation & Setup

### Prerequisites
- Node.js (v14 or higher)
- MongoDB (local or Atlas account)
- Cloudinary account (for image uploads)

### 1. Clone and Install Dependencies

```bash
cd chat99

# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### 2. Environment Configuration

Create `.env` file in server directory:
```bash
cd server
cp .env.example .env
```

Update `.env` with your credentials:
```env
PORT=3001
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/chat99
CLIENT_URL=http://localhost:3000
JWT_SECRET=your-super-secret-jwt-key-here
CLOUDINARY_CLOUD_NAME=your-cloudinary-cloud-name
CLOUDINARY_API_KEY=your-cloudinary-api-key
CLOUDINARY_API_SECRET=your-cloudinary-api-secret
```

### 3. Database Setup (MongoDB Atlas - Free)

1. Go to [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Create free account and cluster
3. Get connection string
4. Update `MONGODB_URI` in `.env`

### 4. Image Storage Setup (Cloudinary - Free)

1. Go to [Cloudinary](https://cloudinary.com/)
2. Create free account (10GB storage)
3. Get API credentials from dashboard
4. Update Cloudinary settings in `.env`

## 🚀 Running the Application

### Development Mode

Terminal 1 (Server):
```bash
cd server
npm run dev
```

Terminal 2 (Client):
```bash
cd client
npm run dev
```

The application will be available at:
- Client: http://localhost:3000
- Server: http://localhost:3001

### Production Mode

```bash
cd server
npm start
```

## 🌐 Deployment

### Deploy to Render.com (Free)

1. Push code to GitHub
2. Connect Render.com to your GitHub repo
3. Create new Web Service
4. Set environment variables in Render dashboard
5. Deploy!

## 🎯 How It Works

1. **Join Platform**: Users can chat as guests or register
2. **Gender Selection**: Choose your gender and who you want to chat with
3. **Matching Algorithm**: System pairs users based on preferences
4. **Real-time Chat**: Instant messaging with image sharing
5. **Rate Limiting**: Max 2 messages until stranger replies (anti-spam)
6. **Easy Disconnect**: Start new conversations anytime

## 🔧 Key Features Implementation

### Message Rate Limiting
- Users can send maximum 2 messages
- Must wait for stranger's reply to continue
- Prevents spam and encourages conversation

### Gender Filtering
- Select your gender during setup
- Choose who you want to chat with
- Smart matching algorithm pairs compatible users

### Image Sharing
- Click camera icon to share images
- Automatic image optimization via Cloudinary
- 5MB file size limit

### Guest Mode
- No registration required
- Anonymous usernames (Guest1234)
- Instant access to chat platform

## 📱 Mobile Optimization

- Responsive design for all screen sizes
- Touch-friendly interface
- Optimized for mobile chat experience

## 🔒 Security Features

- Helmet.js for security headers
- Rate limiting for API endpoints
- Input validation and sanitization
- No personal data storage for guests

## 🎨 Customization

### Branding
- Update colors in `client/style.css`
- Change logo/name in `client/index.html`
- Modify welcome messages

### Features
- Add user registration system
- Implement video chat
- Add chat history
- Create user profiles

## 📈 SEO Optimization

**Target Keywords**: 
- "stranger chat"
- "random chat"
- "online dating chat"
- "anonymous chat"
- "chat with strangers"

The name "Chat99" is designed to rank well for these searches.

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Make changes
4. Test thoroughly
5. Submit pull request

## 📄 License

MIT License - feel free to use for personal or commercial projects.

## 🆘 Support

For issues or questions:
1. Check the GitHub Issues page
2. Create new issue with detailed description
3. Include error logs if applicable

---

**Chat99** - Connect with strangers worldwide! 🌍💬