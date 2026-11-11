import { useEffect, useRef, useState } from 'react';

type Quote = {
  id: string;
  jobDescription: string;
  currency: string;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  subtotal: number;
  tax: number;
  total: number;
  notes: string;
};

const MAX_RECORDING_SECONDS = 90;

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
  }).format(value);
}

export default function App() {
  const [recorder, setRecorder] = useState<MediaRecorder | null>(null);
  const [audio, setAudio] = useState<Blob | null>(null);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [contractorName, setContractorName] = useState('Your Contractor');
  const [contractorEmail, setContractorEmail] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [taxRate, setTaxRate] = useState('0');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [quote, setQuote] = useState<Quote | null>(null);
  const timer = useRef<number | null>(null);
  const stream = useRef<MediaStream | null>(null);

  useEffect(() => () => {
    if (timer.current !== null) window.clearInterval(timer.current);
    stream.current?.getTracks().forEach((track) => track.stop());
  }, []);

  async function startRecording() {
    setError('');
    setQuote(null);
    setAudio(null);
    setSeconds(0);

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Audio recording is not supported in this browser. Try a current version of Chrome, Edge, or Safari.');
      return;
    }

    try {
      const currentStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = currentStream;
      const mimeType = ['audio/webm;codecs=opus', 'audio/mp4']
        .find((type) => MediaRecorder.isTypeSupported(type));
      const currentRecorder = new MediaRecorder(
        currentStream,
        mimeType ? { mimeType, audioBitsPerSecond: 64000 } : { audioBitsPerSecond: 64000 },
      );
      const chunks: BlobPart[] = [];

      currentRecorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      currentRecorder.onstop = () => {
        if (chunks.length) {
          const recordingBlob = new Blob(chunks, { type: currentRecorder.mimeType || 'audio/webm' });
          if (recordingBlob.size > 4 * 1024 * 1024) {
            setError('This recording is too large to upload. Try a shorter recording.');
          } else {
            setAudio(recordingBlob);
          }
        }
        currentStream.getTracks().forEach((track) => track.stop());
        stream.current = null;
        if (timer.current !== null) window.clearInterval(timer.current);
        timer.current = null;
        setRecording(false);
      };

      currentRecorder.start();
      setRecorder(currentRecorder);
      setRecording(true);
      timer.current = window.setInterval(() => {
        setSeconds((current) => {
          const next = current + 1;
          if (next >= MAX_RECORDING_SECONDS) {
            if (currentRecorder.state === 'recording') currentRecorder.stop();
            return MAX_RECORDING_SECONDS;
          }
          return next;
        });
      }, 1000);
    } catch {
      setError('Microphone access was not granted. Allow microphone access and try again.');
    }
  }

  function stopRecording() {
    if (recorder?.state === 'recording') recorder.stop();
  }

  function chooseAudio(file: File | undefined) {
    setError('');
    setQuote(null);
    if (!file) return;
    if (!file.type.startsWith('audio/')) {
      setError('Choose an audio file to continue.');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setError('Audio files must be smaller than 4 MB. Try a shorter recording.');
      return;
    }
    setAudio(file);
    setSeconds(0);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!audio) {
      setError('Record or choose an audio clip before generating a quote.');
      return;
    }
    setLoading(true);
    setError('');
    setQuote(null);

    const formData = new FormData();
    formData.append('audio', audio, 'job-recording.webm');
    formData.append('contractorName', contractorName.trim());
    formData.append('contractorEmail', contractorEmail.trim());
    formData.append('customerName', customerName.trim());
    formData.append('customerEmail', customerEmail.trim());
    formData.append('currency', currency);
    formData.append('taxRate', taxRate);

    try {
      const response = await fetch('/api/quotes', { method: 'POST', body: formData });
      const result = await response.json() as { quote?: Quote; error?: string };
      if (!response.ok || !result.quote) {
        throw new Error(result.error || 'The quote could not be generated. Please try again.');
      }
      setQuote(result.quote);
      setAudio(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page-shell">
      <nav className="topbar" aria-label="Main navigation">
        <a className="wordmark" href="/" aria-label="Quotely home">
          <span className="brand-mark" aria-hidden="true">q</span>
          <span>quotely</span>
        </a>
        <span className="topbar-note">Made for the work you do</span>
      </nav>

      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow"><span className="live-dot" /> VOICE-TO-QUOTE FOR CONTRACTORS</span>
          <h1>Speak the job.<br /><span>Send the quote.</span></h1>
          <p>One quick recording turns your site notes into a polished quote, ready for your customer’s inbox.</p>
        </div>
        <div className="hero-art" aria-hidden="true">
          <span className="orbit orbit-one" />
          <span className="orbit orbit-two" />
          <span className="orbit orbit-three" />
          <span className="hero-spark">✳</span>
          <span className="hero-caption">YOUR NEXT QUOTE,<br />IN A FEW MINUTES</span>
        </div>
      </section>

      <section className="workspace" aria-label="Create a quote">
        <form className="quote-form" onSubmit={handleSubmit}>
          <div className="form-heading">
            <div>
              <span className="step-label">LET’S GET IT DONE</span>
              <h2>Start with the job</h2>
            </div>
            <span className="step-count">01 <span>/ 01</span></span>
          </div>

          <div className="recorder">
            <div className={`record-icon ${recording ? 'is-recording' : ''}`} aria-hidden="true">
              <span />
            </div>
            <div className="record-copy">
              <strong>{recording ? 'Listening to the job' : audio ? 'Recording is ready' : 'Tell us what needs doing'}</strong>
              <span>{recording ? 'Speak naturally — details help make a better quote.' : audio ? 'Ready to turn your notes into a quote.' : 'Tap to record a voice note, or upload audio below.'}</span>
            </div>
            {recording ? (
              <button className="record-button stop-button" type="button" onClick={stopRecording}>
                <span className="stop-square" /> Stop <span className="record-time">{seconds}s</span>
              </button>
            ) : (
              <button className="record-button" type="button" onClick={startRecording} disabled={loading}>
                <span className="record-dot" /> {audio ? 'Re-record' : 'Record'}
              </button>
            )}
          </div>
          <div className="record-meta">
            <span><span className="tiny-dot" /> Up to 90 seconds</span>
            <label className="upload-link">
              Or upload audio
              <input
                type="file"
                accept="audio/*"
                onChange={(event) => chooseAudio(event.currentTarget.files?.[0])}
                disabled={loading || recording}
              />
            </label>
            {audio && <button className="clear-audio" type="button" onClick={() => setAudio(null)}>Remove audio</button>}
          </div>

          <div className="form-divider"><span>WHO’S SENDING THE QUOTE?</span></div>
          <div className="field-grid">
            <label className="field">
              <span>Business name</span>
              <input
                autoComplete="organization"
                maxLength={120}
                placeholder="Your Contractor"
                value={contractorName}
                onChange={(event) => setContractorName(event.target.value)}
                required
                disabled={loading}
              />
            </label>
            <label className="field">
              <span>Your email <span className="field-hint">customer replies go here</span></span>
              <input
                type="email"
                autoComplete="email"
                maxLength={254}
                placeholder="you@yourbusiness.com"
                value={contractorEmail}
                onChange={(event) => setContractorEmail(event.target.value)}
                required
                disabled={loading}
              />
            </label>
          </div>

          <div className="form-divider"><span>WHO’S IT FOR?</span></div>
          <div className="field-grid">
            <label className="field">
              <span>Customer name</span>
              <input
                autoComplete="name"
                maxLength={120}
                placeholder="e.g. Jamie Parker"
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                required
                disabled={loading}
              />
            </label>
            <label className="field">
              <span>Customer email</span>
              <input
                type="email"
                autoComplete="email"
                maxLength={254}
                placeholder="jamie@example.com"
                value={customerEmail}
                onChange={(event) => setCustomerEmail(event.target.value)}
                required
                disabled={loading}
              />
            </label>
          </div>

          <div className="field-grid options-grid">
            <label className="field">
              <span>Quote currency</span>
              <select value={currency} onChange={(event) => setCurrency(event.target.value)} disabled={loading}>
                <option value="USD">USD — US Dollar</option>
                <option value="CAD">CAD — Canadian Dollar</option>
                <option value="GBP">GBP — British Pound</option>
                <option value="EUR">EUR — Euro</option>
                <option value="AUD">AUD — Australian Dollar</option>
                <option value="ZAR">ZAR — South African Rand</option>
              </select>
            </label>
            <label className="field">
              <span>Tax rate <span className="field-hint">optional</span></span>
              <div className="input-suffix">
                <input
                  type="number"
                  min="0"
                  max="25"
                  step="0.01"
                  value={taxRate}
                  onChange={(event) => setTaxRate(event.target.value)}
                  disabled={loading}
                />
                <span>%</span>
              </div>
            </label>
          </div>

          {error && <p className="alert" role="alert">{error}</p>}

          <div className="submit-row">
            <p>AI-generated pricing is an estimate.<br />Review the quote before accepting it.</p>
            <button className="submit-button" type="submit" disabled={!audio || !contractorName.trim() || !contractorEmail.trim() || !customerName.trim() || !customerEmail.trim() || loading || recording}>
              {loading ? (
                <><span className="spinner" /> Quotely is generating…</>
              ) : (
                <>Generate &amp; send quote <span aria-hidden="true">↗</span></>
              )}
            </button>
          </div>
          <p className="privacy-note"><span aria-hidden="true">⌑</span> Your recording is used only to prepare this quote.</p>
        </form>

        <aside className="side-note">
          <div className="note-number">01 — 03</div>
          <h3>Good details make great quotes.</h3>
          <p>Mention the materials, measurements, and any timing details you already know. Quotely will organize the details into clear line items.</p>
          <div className="note-divider" />
          <span className="note-footer"><span className="note-star">✳</span> Less paperwork.<br />More time on the tools.</span>
        </aside>
      </section>

      {quote && (
        <section className="result-card" aria-live="polite">
          <div className="result-heading">
            <div>
              <span className="step-label">QUOTE SENT</span>
              <h2>Your quote is on its way.</h2>
            </div>
            <span className="sent-badge"><span /> Emailed to customer</span>
          </div>
          <p className="job-description">{quote.jobDescription}</p>
          <div className="quote-table">
            {quote.lineItems.map((item, index) => (
              <div className="quote-row" key={`${item.description}-${index}`}>
                <span>{item.description}<small>Qty {item.quantity} · {formatMoney(item.unitPrice, quote.currency)} each</small></span>
                <strong>{formatMoney(item.total, quote.currency)}</strong>
              </div>
            ))}
          </div>
          <div className="quote-total">
            <span>Subtotal <strong>{formatMoney(quote.subtotal, quote.currency)}</strong></span>
            <span>Tax <strong>{formatMoney(quote.tax, quote.currency)}</strong></span>
            <span className="grand-total">Total <strong>{formatMoney(quote.total, quote.currency)}</strong></span>
          </div>
          {quote.notes && <p className="quote-notes">{quote.notes}</p>}
          <button className="new-quote" type="button" onClick={() => setQuote(null)}>Create another quote <span aria-hidden="true">↗</span></button>
        </section>
      )}

      <footer className="footer">
        <span>© {new Date().getFullYear()} Quotely</span>
        <span>Speak the job. Send the quote.</span>
      </footer>
    </main>
  );
}
