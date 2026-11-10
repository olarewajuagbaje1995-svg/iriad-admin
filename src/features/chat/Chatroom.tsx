import React, { useMemo, useState } from "react";
import {
  Search, Plus, Send, Paperclip, Smile, MoreHorizontal,
  Hash, Users, MessageCircle, Pin, Bell, ChevronDown,
  ArrowLeft, Image, FileText, CheckCheck
} from "lucide-react";
import "./Chatroom.css";

type Message = {
  id: number;
  sender: string;
  initials: string;
  text: string;
  time: string;
  mine?: boolean;
};

type Room = {
  id: string;
  name: string;
  description: string;
  members: number;
  unread: number;
  color: string;
  messages: Message[];
};

const initialRooms: Room[] = [
  {
    id: "general",
    name: "General Staff",
    description: "General organisational communication",
    members: 12,
    unread: 3,
    color: "teal",
    messages: [
      { id: 1, sender: "Admin", initials: "AD", text: "Good morning, everyone. Welcome to our staff communication space.", time: "09:00 AM" },
      { id: 2, sender: "Staff Member 01", initials: "S1", text: "Good morning. Wishing everyone a productive day.", time: "09:05 AM" },
      { id: 3, sender: "Staff Member 02", initials: "S2", text: "Please, are we having the programme coordination meeting today?", time: "09:12 AM" },
      { id: 4, sender: "Admin", initials: "AD", text: "Yes. The meeting is scheduled for 10:00 AM. Please check the calendar for details.", time: "09:16 AM" },
    ],
  },
  {
    id: "management",
    name: "Management",
    description: "Management and leadership discussions",
    members: 4,
    unread: 1,
    color: "purple",
    messages: [
      { id: 1, sender: "Admin", initials: "AD", text: "Welcome to the management discussion room.", time: "08:30 AM" },
      { id: 2, sender: "Staff Member 03", initials: "S3", text: "The monthly operational report is ready for review.", time: "08:45 AM" },
    ],
  },
  {
    id: "research",
    name: "Research & Policy",
    description: "Research activities, policy and publications",
    members: 5,
    unread: 0,
    color: "blue",
    messages: [
      { id: 1, sender: "Staff Member 04", initials: "S4", text: "The policy research draft has been uploaded for review.", time: "Yesterday" },
    ],
  },
  {
    id: "programmes",
    name: "Programmes & Projects",
    description: "Programme implementation and project updates",
    members: 7,
    unread: 2,
    color: "orange",
    messages: [
      { id: 1, sender: "Staff Member 01", initials: "S1", text: "We have completed the first stage of the project activities.", time: "Yesterday" },
    ],
  },
  {
    id: "communications",
    name: "Communications",
    description: "Media, content and public engagement",
    members: 3,
    unread: 0,
    color: "pink",
    messages: [
      { id: 1, sender: "Staff Member 02", initials: "S2", text: "The new campaign graphics are ready.", time: "Yesterday" },
    ],
  },
  {
    id: "administration",
    name: "Administration",
    description: "Administrative coordination and internal support",
    members: 4,
    unread: 0,
    color: "green",
    messages: [
      { id: 1, sender: "Admin", initials: "AD", text: "Please ensure all outstanding administrative records are updated.", time: "Monday" },
    ],
  },
];

export default function Chatroom() {
  const [rooms, setRooms] = useState(initialRooms);
  const [activeRoom, setActiveRoom] = useState("general");
  const [message, setMessage] = useState("");
  const [roomSearch, setRoomSearch] = useState("");
  const [messageSearch, setMessageSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileChat, setMobileChat] = useState(false);
  const [showRoomForm, setShowRoomForm] = useState(false);
  const [newRoom, setNewRoom] = useState("");
  const [filter, setFilter] = useState("All rooms");

  const room = rooms.find(r => r.id === activeRoom)!;

  const filteredRooms = useMemo(() =>
    rooms.filter(r => {
      const matches = r.name.toLowerCase().includes(roomSearch.toLowerCase());
      return matches && (filter === "All rooms" || r.unread > 0);
    }), [rooms, roomSearch, filter]);

  const visibleMessages = room.messages.filter(m =>
    m.text.toLowerCase().includes(messageSearch.toLowerCase())
  );

  const sendMessage = (
    e: React.FormEvent<HTMLFormElement> | React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    e.preventDefault();
    if (!message.trim()) return;

    const newMessage: Message = {
      id: Date.now(),
      sender: "Administrator",
      initials: "AD",
      text: message.trim(),
      time: new Date().toLocaleTimeString("en-NG", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }),
      mine: true,
    };

    setRooms(prev => prev.map(r =>
      r.id === activeRoom
        ? { ...r, messages: [...r.messages, newMessage] }
        : r
    ));
    setMessage("");
  };

  const selectRoom = (id: string) => {
    setActiveRoom(id);
    setMobileChat(true);
    setRooms(prev => prev.map(r =>
      r.id === id ? { ...r, unread: 0 } : r
    ));
    setMessageSearch("");
  };

  const createRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoom.trim()) return;

    const id = `room-${Date.now()}`;
    const created: Room = {
      id,
      name: newRoom.trim(),
      description: "New organisational discussion room",
      members: 1,
      unread: 0,
      color: "teal",
      messages: [],
    };

    setRooms(prev => [...prev, created]);
    setNewRoom("");
    setShowRoomForm(false);
    selectRoom(id);
  };

  return (
    <div className={`iriad-chat ${mobileChat ? "mobile-chat-open" : ""}`}>
      <aside className="chat-sidebar">
        <div className="chat-sidebar-heading">
          <div>
            <span className="chat-eyebrow">COMMUNICATION</span>
            <h2>Team Chat</h2>
            <p>Connect with your colleagues</p>
          </div>
          <button className="chat-add-button" onClick={() => setShowRoomForm(true)} title="Create room">
            <Plus size={19} />
          </button>
        </div>

        <div className="chat-search">
          <Search size={16} />
          <input
            placeholder="Find a room..."
            value={roomSearch}
            onChange={e => setRoomSearch(e.target.value)}
          />
        </div>

        <div className="chat-filter">
          {["All rooms", "Unread"].map(item => (
            <button
              key={item}
              className={filter === item ? "filter-active" : ""}
              onClick={() => setFilter(item)}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="rooms-heading">
          <span>ORGANISATION ROOMS</span>
          <span>{rooms.length}</span>
        </div>

        <div className="room-list">
          {filteredRooms.map(r => (
            <button
              key={r.id}
              className={`room-item ${activeRoom === r.id ? "room-active" : ""}`}
              onClick={() => selectRoom(r.id)}
            >
              <div className={`room-icon ${r.color}`}>
                <Hash size={18} />
              </div>
              <div className="room-details">
                <strong>{r.name}</strong>
                <small>{r.messages[r.messages.length - 1]?.text || "Start a conversation"}</small>
              </div>
              <div className="room-meta">
                {r.unread > 0 && <span className="unread-count">{r.unread}</span>}
                <small>{r.messages.length ? r.messages[r.messages.length - 1].time : ""}</small>
              </div>
            </button>
          ))}
          {filteredRooms.length === 0 && (
            <p className="chat-empty">No matching rooms found.</p>
          )}
        </div>

        <div className="chat-sidebar-footer">
          <div className="chat-user-avatar">AD</div>
          <div>
            <strong>Administrator</strong>
            <small><span className="online-dot" /> Online</small>
          </div>
          <MoreHorizontal size={19} />
        </div>
      </aside>

      <main className="chat-main">
        <header className="chat-header">
          <div className="chat-room-title">
            <button className="chat-back" onClick={() => setMobileChat(false)}>
              <ArrowLeft size={19} />
            </button>
            <div className={`room-icon header-room-icon ${room.color}`}>
              <Hash size={20} />
            </div>
            <div>
              <h3>{room.name}</h3>
              <p>{room.description}</p>
            </div>
          </div>

          <div className="chat-header-actions">
            <button onClick={() => setSearchOpen(!searchOpen)} title="Search messages">
              <Search size={19} />
            </button>
            <button title="Room members">
              <Users size={19} />
              <span>{room.members}</span>
            </button>
            <button title="More options"><MoreHorizontal size={20} /></button>
          </div>
        </header>

        {searchOpen && (
          <div className="message-search">
            <Search size={16} />
            <input
              placeholder="Search messages in this room..."
              value={messageSearch}
              onChange={e => setMessageSearch(e.target.value)}
            />
            <button onClick={() => { setSearchOpen(false); setMessageSearch(""); }}>×</button>
          </div>
        )}

        <div className="chat-pinned">
          <Pin size={14} />
          <span>Welcome to the IRIAD team communication space.</span>
          <button>View</button>
        </div>

        <div className="chat-messages">
          <div className="chat-date-divider"><span>RECENT MESSAGES</span></div>

          {visibleMessages.map((msg) => (
            <div className={`message-row ${msg.mine ? "own-message" : ""}`} key={msg.id}>
              {!msg.mine && (
                <div className="message-avatar">{msg.initials}</div>
              )}
              <div className="message-content">
                {!msg.mine && (
                  <div className="message-author">
                    <strong>{msg.sender}</strong>
                    <span>{msg.time}</span>
                  </div>
                )}
                <div className="message-bubble">{msg.text}</div>
                {msg.mine && (
                  <div className="message-time">{msg.time} <CheckCheck size={13} /></div>
                )}
              </div>
            </div>
          ))}

          {visibleMessages.length === 0 && (
            <div className="chat-empty">No messages match your search.</div>
          )}
        </div>

        <form className="chat-composer" onSubmit={sendMessage}>
          <div className="composer-toolbar">
            <button type="button" title="Attachments"><Paperclip size={18} /></button>
            <button type="button" title="Images"><Image size={18} /></button>
            <button type="button" title="Files"><FileText size={18} /></button>
            <span>Message to #{room.name}</span>
          </div>
          <div className="composer-input">
            <textarea
              placeholder="Write a message to your team..."
              value={message}
              onChange={e => setMessage(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage(e);
                }
              }}
              rows={2}
            />
            <button type="button" className="emoji-button" title="Emoji">
              <Smile size={19} />
            </button>
            <button className="send-button" type="submit" disabled={!message.trim()}>
              <Send size={17} />
            </button>
          </div>
          <div className="composer-hint">Press Enter to send · Shift + Enter for a new line</div>
        </form>
      </main>

      <aside className="chat-info-panel">
        <div className="info-top">
          <div className={`room-icon info-room-icon ${room.color}`}><Hash size={23} /></div>
          <h3>{room.name}</h3>
          <p>{room.description}</p>
          <span className="member-pill"><Users size={13} /> {room.members} members</span>
        </div>

        <div className="info-section">
          <h4>ROOM DETAILS</h4>
          <p>This room is for organisational communication and collaboration among IRIAD team members.</p>
        </div>

        <div className="info-section">
          <h4>ROOM SETTINGS</h4>
          <button><Bell size={16} /> Notifications <ChevronDown size={15} /></button>
          <button><Users size={16} /> View members <ChevronDown size={15} /></button>
          <button><Pin size={16} /> Pinned messages <ChevronDown size={15} /></button>
        </div>

        <div className="info-section">
          <h4>QUICK INFORMATION</h4>
          <div className="info-stat"><span>Messages</span><strong>{room.messages.length}</strong></div>
          <div className="info-stat"><span>Members</span><strong>{room.members}</strong></div>
          <div className="info-stat"><span>Room type</span><strong>Group</strong></div>
        </div>

        <div className="info-footer">
          <MessageCircle size={17} />
          <span>IRIAD Team Communication</span>
        </div>
      </aside>

      {showRoomForm && (
        <div className="chat-modal-backdrop" onClick={() => setShowRoomForm(false)}>
          <form className="chat-modal" onClick={e => e.stopPropagation()} onSubmit={createRoom}>
            <div className="modal-title">
              <div><span className="chat-eyebrow">NEW DISCUSSION</span><h3>Create a room</h3></div>
              <button type="button" onClick={() => setShowRoomForm(false)}>×</button>
            </div>
            <label>Room name</label>
            <input
              autoFocus
              value={newRoom}
              onChange={e => setNewRoom(e.target.value)}
              placeholder="e.g. Finance & Administration"
              required
            />
            <button className="create-room-submit" type="submit">Create room</button>
          </form>
        </div>
      )}
    </div>
  );
}
