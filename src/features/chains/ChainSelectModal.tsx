import { ChainLogo } from '@hyperlane-xyz/widgets';

import { Modal } from '../../components/layout/Modal';

import { getChainDisplayName, getChainMetadata } from './metadata';

export function ChainSelectListModal({
  isOpen,
  close,
  chainIds,
  onSelect,
}: {
  isOpen: boolean;
  close: () => void;
  chainIds: number[];
  onSelect: (chainId: number) => void;
}) {
  const onSelectChain = (chainId: number) => {
    return () => {
      onSelect(chainId);
      close();
    };
  };

  const chainMetadata = chainIds.map((c) => getChainMetadata(c));

  return (
    <Modal isOpen={isOpen} title="Select Chain" close={close}>
      <div className="mt-2 flex flex-col space-y-1">
        {chainMetadata.map((c) => (
          <button
            key={c.name}
            className="py-1.5 px-2 text-sm flex items-center rounded hover:bg-gray-100 active:bg-gray-200 transition-all duration-200"
            onClick={onSelectChain(c.chainId)}
          >
            <ChainLogo chainId={c.chainId} size={16} background={false} />
            <span className="ml-2">{getChainDisplayName(c.chainId, true)}</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}

// TODO update to support dynamic chain lists
// export function ChainSelectGridModal({
//   isOpen,
//   close,
//   onSelect,
// }: {
//   isOpen: boolean;
//   close: () => void;
//   onSelect: (chainId: number) => void;
// }) {
//   const onSelectChain = (chainId: number) => {
//     return () => {
//       onSelect(chainId);
//       close();
//     };
//   };

//   return (
//     <Modal isOpen={isOpen} title="elect Chain" close={close}>
//       <div className="mt-1 flex justify-between">
//         <div className="flex flex-col space-y-0.5 relative -left-2">
//           <h4 className="py-1.5 px-2 text-sm text-gray-500 uppercase">Mainnet</h4>
//           {mainnetChainsMetadata.map((c) => (
//             <button
//               key={c.name}
//               className="py-1.5 px-2 text-sm flex items-center rounded hover:bg-gray-100 active:bg-gray-200 transition-all duration-200"
//               onClick={onSelectChain(c.id)}
//             >
//               <ChainLogo chainId={c.id} size={16} background={false} />
//               <span className="ml-2">{getChainDisplayName(c.id, true)}</span>
//             </button>
//           ))}
//         </div>
//         <div className="flex flex-col space-y-0.5 pr-3">
//           <h4 className="py-1.5 px-2 text-sm text-gray-500 uppercase">Testnet</h4>
//           {testnetChainsMetadata.map((c) => (
//             <button
//               key={c.name}
//               className="py-1.5 px-2 text-sm flex items-center rounded hover:bg-gray-100 active:bg-gray-200 transition-all duration-200"
//               onClick={onSelectChain(c.id)}
//             >
//               <ChainLogo chainId={c.id} size={16} background={false} />
//               <span className="ml-2">{getChainDisplayName(c.id, true)}</span>
//             </button>
//           ))}
//         </div>
//       </div>
//     </Modal>
//   );
// }
