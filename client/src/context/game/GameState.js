import React, { useContext, useEffect, useState } from 'react';
import { withRouter } from 'react-router-dom';
import {
  CALL,
  CHECK,
  FOLD,
  JOIN_TABLE,
  LEAVE_TABLE,
  RAISE,
  REBUY,
  SIT_DOWN,
  STAND_UP,
  TABLE_JOINED,
  TABLE_LEFT,
  TABLE_UPDATED,
} from '../../pokergame/actions';
import authContext from '../auth/authContext';
import socketContext from '../websocket/socketContext';
import GameContext from './gameContext';

const GameState = ({ history, children }) => {
  const { socket } = useContext(socketContext);
  const { loadUser } = useContext(authContext);

  const [messages, setMessages] = useState([]);
  const [currentTable, setCurrentTable] = useState(null);
  const [isPlayerSeated, setIsPlayerSeated] = useState(false);
  const [seatId, setSeatId] = useState(null);
  const [turn, setTurn] = useState(false);
  const [turnTimeOutHandle, setHandle] = useState(null);

  const currentTableRef = React.useRef(currentTable);

  useEffect(() => {
    currentTableRef.current = currentTable;

    isPlayerSeated &&
      seatId &&
      currentTable.seats[seatId] &&
      turn !== currentTable.seats[seatId].turn &&
      setTurn(currentTable.seats[seatId].turn);
    // eslint-disable-next-line
  }, [currentTable]);

  useEffect(() => {
    if (turn && !turnTimeOutHandle) {
      const handle = setTimeout(fold, 15000);
      setHandle(handle);
    } else {
      turnTimeOutHandle && clearTimeout(turnTimeOutHandle);
      turnTimeOutHandle && setHandle(null);
    }
    // eslint-disable-next-line
  }, [turn]);

  useEffect(() => {
    if (socket) {
      window.addEventListener('unload', leaveTable);
      window.addEventListener('close', leaveTable);

      socket.on(TABLE_UPDATED, ({ table, message, from }) => {
        console.log(TABLE_UPDATED, table, message, from);
        setCurrentTable(table);
        message && addMessage(message);
      });

      socket.on(TABLE_JOINED, ({ tables, tableId }) => {
        console.log(TABLE_JOINED, tables, tableId);
        // Server sends `tables` as an array (getCurrentTables()).
        // The client previously treated `tables` like a keyed object and
        // did `tables[tableId]` which yields `undefined` for IDs that
        // don't match array indices (e.g. id=1 at index 0). Find by id.
        const table = Array.isArray(tables)
          ? tables.find((t) => t.id === tableId)
          : tables && tables[tableId];

        // The `tables` summary from the server does not include full
        // runtime fields (seats, board, winMessages). Provide safe
        // defaults so the UI doesn't read undefined fields while the
        // real full `TABLE_UPDATED` arrives.
        const tableWithDefaults = table
          ? {
              // copy any provided summary fields
              ...table,
              // runtime fields expected by the UI
              board: table.board || [],
              winMessages: table.winMessages || [],
              seats: table.seats || {},
              // players array used by GameStateInfo
              players: table.players || [],
              // other numeric fields UI reads
              pot: typeof table.pot === 'number' ? table.pot : 0,
              callAmount:
                typeof table.callAmount === 'number' ? table.callAmount : 0,
              minBet: typeof table.minBet === 'number' ? table.minBet : table.smallBlind || 0,
              minRaise:
                typeof table.minRaise === 'number'
                  ? table.minRaise
                  : table.minBet || table.smallBlind || 0,
              // pots/sidepots and showdown/hand flags
              mainPot: typeof table.mainPot === 'number' ? table.mainPot : table.pot || 0,
              sidePots: Array.isArray(table.sidePots) ? table.sidePots : [],
              wentToShowdown: !!table.wentToShowdown,
              handOver: !!table.handOver,
            }
          : null;

        setCurrentTable(tableWithDefaults);
      });

      socket.on(TABLE_LEFT, ({ tables, tableId }) => {
        console.log(TABLE_LEFT, tables, tableId);
        setCurrentTable(null);
        loadUser(localStorage.token);
        setMessages([]);
      });
    }
    return () => leaveTable();
    // eslint-disable-next-line
  }, [socket]);

  const joinTable = (tableId) => {
    console.log(JOIN_TABLE, tableId);
    socket.emit(JOIN_TABLE, tableId);
  };

  const leaveTable = () => {
    isPlayerSeated && standUp();
    currentTableRef &&
      currentTableRef.current &&
      currentTableRef.current.id &&
      socket.emit(LEAVE_TABLE, currentTableRef.current.id);
    history.push('/');
  };

  const sitDown = (tableId, seatId, amount) => {
    socket.emit(SIT_DOWN, { tableId, seatId, amount });
    setIsPlayerSeated(true);
    setSeatId(seatId);
  };

  const rebuy = (tableId, seatId, amount) => {
    socket.emit(REBUY, { tableId, seatId, amount });
  };

  const standUp = () => {
    currentTableRef &&
      currentTableRef.current &&
      socket.emit(STAND_UP, currentTableRef.current.id);
    setIsPlayerSeated(false);
    setSeatId(null);
  };

  const addMessage = (message) => {
    setMessages((prevMessages) => [...prevMessages, message]);
    console.log(message);
  };

  const fold = () => {
    currentTableRef &&
      currentTableRef.current &&
      socket.emit(FOLD, currentTableRef.current.id);
  };

  const check = () => {
    currentTableRef &&
      currentTableRef.current &&
      socket.emit(CHECK, currentTableRef.current.id);
  };

  const call = () => {
    currentTableRef &&
      currentTableRef.current &&
      socket.emit(CALL, currentTableRef.current.id);
  };

  const raise = (amount) => {
    currentTableRef &&
      currentTableRef.current &&
      socket.emit(RAISE, { tableId: currentTableRef.current.id, amount });
  };

  return (
    <GameContext.Provider
      value={{
        messages,
        currentTable,
        isPlayerSeated,
        seatId,
        joinTable,
        leaveTable,
        sitDown,
        standUp,
        addMessage,
        fold,
        check,
        call,
        raise,
        rebuy,
      }}
    >
      {children}
    </GameContext.Provider>
  );
};

export default withRouter(GameState);
