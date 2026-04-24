import React from 'react'
import './StatusPanel.css'

const StatusPanel = ({ status, lastMove, isListening }) => {
  return (
    <div className="status-panel">
      <div className={`status ${isListening ? 'listening' : ''}`}>
        {isListening && <span className="mic-icon">🎤</span>}
        {status}
      </div>

      {lastMove && (
        <div className="last-move">
          <span className="label">Последний ход:</span>
          <span className="move">{lastMove.toUpperCase()}</span>
        </div>
      )}
    </div>
  )
}

export default StatusPanel
