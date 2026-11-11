import { parseAbi, parseAbiItem } from 'viem';

export const warpRouterAbi = parseAbi([
  'function quoteTransferRemote(uint32 destination, bytes32 recipient, uint256 amount) view returns ((address token, uint256 amount)[])',
  'function quoteGasPayment(uint32 destination) view returns (uint256)',
  'function transferRemote(uint32 destination, bytes32 recipient, uint256 amount) payable returns (bytes32)',
  'function balanceOf(address) view returns (uint256)',
  'function totalSupply() view returns (uint256)',
]);
export const erc20Abi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
]);
export const mailboxAbi = parseAbi(['function delivered(bytes32 messageId) view returns (bool)']);
export const dispatchIdEvent = parseAbiItem('event DispatchId(bytes32 indexed messageId)');
export const processIdEvent = parseAbiItem('event ProcessId(bytes32 indexed messageId)');
export const sentTransferEvent = parseAbiItem(
  'event SentTransferRemote(uint32 indexed destination, bytes32 indexed recipient, uint256 amount)',
);
export const receivedTransferEvent = parseAbiItem(
  'event ReceivedTransferRemote(uint32 indexed origin, bytes32 indexed recipient, uint256 amount)',
);

export const inboxAbi = parseAbi(['function depositEth() payable returns (uint256)']);
export const messageDeliveredEvent = parseAbiItem(
  'event MessageDelivered(uint256 indexed messageIndex, bytes32 indexed beforeInboxAcc, address inbox, uint8 kind, address sender, bytes32 messageDataHash, uint256 baseFeeL1, uint64 timestamp)',
);
export const inboxMessageDeliveredEvent = parseAbiItem(
  'event InboxMessageDelivered(uint256 indexed messageNum, bytes data)',
);
export const arbSysAbi = parseAbi(['function withdrawEth(address destination) payable returns (uint256)']);
export const l2ToL1TxEvent = parseAbiItem(
  'event L2ToL1Tx(address caller, address indexed destination, uint256 indexed hash, uint256 indexed position, uint256 arbBlockNum, uint256 ethBlockNum, uint256 timestamp, uint256 callvalue, bytes data)',
);
export const nodeInterfaceAbi = parseAbi([
  'function constructOutboxProof(uint64 size, uint64 leaf) view returns (bytes32 send, bytes32 root, bytes32[] proof)',
]);
export const outboxAbi = parseAbi([
  'function executeTransaction(bytes32[] proof, uint256 index, address l2Sender, address to, uint256 l2Block, uint256 l1Block, uint256 l2Timestamp, uint256 value, bytes data)',
  'function isSpent(uint256 index) view returns (bool)',
]);
export const rollupAbi = parseAbi([
  'function latestConfirmed() view returns (bytes32)',
  'function confirmPeriodBlocks() view returns (uint64)',
]);
export const assertionConfirmedEvent = parseAbiItem(
  'event AssertionConfirmed(bytes32 indexed assertionHash, bytes32 blockHash, bytes32 sendRoot)',
);
