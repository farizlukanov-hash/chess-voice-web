import React from 'react'
import './ChessBoard.css'

const ChessBoard = ({ fen }) => {
  const parseFen = (fen) => {
    const rows = fen.split(' ')[0].split('/')
    const board = []

    rows.forEach((row) => {
      const boardRow = []
      for (let char of row) {
        if (isNaN(char)) {
          boardRow.push(char)
        } else {
          for (let i = 0; i < parseInt(char); i++) {
            boardRow.push(null)
          }
        }
      }
      board.push(boardRow)
    })

    return board
  }

  const getPieceSymbol = (piece) => {
    const symbols = {
      'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙',
      'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟'
    }
    return symbols[piece] || ''
  }

  const board = parseFen(fen)
  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
  const ranks = ['8', '7', '6', '5', '4', '3', '2', '1']

  return (
    <div className="board-container">
      <div className="files-top">
        {files.map(file => (
          <div key={file} className="coordinate">{file}</div>
        ))}
      </div>

      <div className="board-with-ranks">
        <div className="ranks-left">
          {ranks.map(rank => (
            <div key={rank} className="coordinate">{rank}</div>
          ))}
        </div>

        <div className="chess-board">
          {board.map((row, rowIndex) => (
            <div key={rowIndex} className="board-row">
              {row.map((piece, colIndex) => {
                const isLight = (rowIndex + colIndex) % 2 === 0
                return (
                  <div
                    key={colIndex}
                    className={`square ${isLight ? 'light' : 'dark'}`}
                  >
                    {piece && (
                      <span className={`piece ${piece === piece.toUpperCase() ? 'white' : 'black'}`}>
                        {getPieceSymbol(piece)}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        <div className="ranks-right">
          {ranks.map(rank => (
            <div key={rank} className="coordinate">{rank}</div>
          ))}
        </div>
      </div>

      <div className="files-bottom">
        {files.map(file => (
          <div key={file} className="coordinate">{file}</div>
        ))}
      </div>
    </div>
  )
}

export default ChessBoard
