interface Props {
  classes?: string;
}

export function HrDivider(props: Props) {
  const { classes } = props;
  return <hr className={`w-full h-px border-none bg-gray-300 ${classes}`} />;
}
