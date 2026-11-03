declare type Address = string;
declare type ChainName = string;
declare type ChainId = number | string;
declare type DomainId = number;

declare module '*.css' {
  const content: string;
  export default content;
}

declare module '@interchain-ui/react/styles';

declare module '*.yaml' {
  const data: any;
  export default data;
}
