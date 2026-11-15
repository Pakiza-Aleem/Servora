import { useEffect, useRef, useState } from 'react';
import { Bot, LoaderCircle, MessageCircle, RotateCcw, Send, Sparkles, X } from 'lucide-react';
import { api, errMsg } from '../api.js';
import '../styles/ai-assistant.css';

const suggestions = [
  'What were my total sales this week?',
  'Which menu items sold the most?',
  'Which ingredients need restocking?',
  'What are my busiest business hours?',
];

export default function AiAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const messageList = useRef(null);

  useEffect(() => {
    if (open && messageList.current) {
      messageList.current.scrollTop = messageList.current.scrollHeight;
    }
  }, [open, messages, busy]);

  const send = async (text = question) => {
    const prompt = text.trim();
    if (!prompt || busy) return;
    setMessages((current) => [...current, { role: 'user', text: prompt }]);
    setQuestion('');
    setError('');
    setBusy(true);
    try {
      const { data } = await api.post('/ai/assistant', { question: prompt }, { timeout: 90000 });
      if (typeof data.answer !== 'string' || !data.answer.trim()) {
        throw new Error('SERVORA AI returned an empty response. Please try again.');
      }
      setMessages((current) => [...current, { role: 'assistant', text: data.answer.trim() }]);
    } catch (e) {
      setError(errMsg(e) || 'SERVORA AI could not respond. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const newConversation = () => {
    setMessages([]);
    setQuestion('');
    setError('');
  };

  return (
    <div className={`ai-assistant ${open ? 'ai-assistant--open' : ''}`}>
      {open && (
        <section className="ai-assistant__panel" role="dialog" aria-label="SERVORA AI assistant">
          <header className="ai-assistant__header">
            <div className="ai-assistant__identity">
              <span className="ai-assistant__brand-icon"><Sparkles size={18} /></span>
              <span><strong>SERVORA AI</strong><small>Restaurant business assistant</small></span>
            </div>
            <div className="ai-assistant__header-actions">
              <button type="button" onClick={newConversation} aria-label="Start a new conversation" title="New conversation">
                <RotateCcw size={17} />
              </button>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close SERVORA AI">
                <X size={19} />
              </button>
            </div>
          </header>

          <div className="ai-assistant__messages" ref={messageList} role="log" aria-live="polite">
            {messages.length === 0 ? (
              <div className="ai-assistant__welcome">
                <span className="ai-assistant__welcome-icon"><Bot size={24} /></span>
                <strong>How can I help your restaurant?</strong>
                <p>Ask about sales, menu performance, busy hours, or stock.</p>
                <div className="ai-assistant__suggestions">
                  {suggestions.map((item) => (
                    <button type="button" key={item} onClick={() => send(item)} disabled={busy}>
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((message, index) => (
                <div className={`ai-message ai-message--${message.role}`} key={`${message.role}-${index}`}>
                  <p>{message.text}</p>
                </div>
              ))
            )}
            {busy && (
              <div className="ai-message ai-message--assistant ai-message--loading" role="status">
                <LoaderCircle size={17} />
                <span>SERVORA AI is preparing a complete answer…</span>
              </div>
            )}
            {error && <p className="ai-assistant__error" role="alert">{error}</p>}
          </div>

          <form
            className="ai-assistant__form"
            onSubmit={(event) => {
              event.preventDefault();
              send();
            }}
          >
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  send();
                }
              }}
              maxLength={1000}
              rows={1}
              placeholder="Ask about your restaurant…"
              aria-label="Ask SERVORA AI a question"
              disabled={busy}
            />
            <button type="submit" aria-label="Send question" disabled={busy || !question.trim()}>
              <Send size={17} />
            </button>
          </form>
          <p className="ai-assistant__note">Answers use your restaurant’s data. AI can make mistakes.</p>
        </section>
      )}

      <button
        className="ai-assistant__toggle"
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? 'Close SERVORA AI assistant' : 'Open SERVORA AI assistant'}
        aria-expanded={open}
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
        {!open && <span>SERVORA AI</span>}
      </button>
    </div>
  );
}
