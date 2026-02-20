import { Badge, Box } from '@chakra-ui/react';
import type { Assignment, Role } from '../types';

type Props = {
  assignment: Assignment;
  role?: Role;
  labelOverride?: string;
  onClick?: () => void;
};

export function AssignmentCell({ assignment, role, labelOverride, onClick }: Props): JSX.Element {
  const isFree = assignment.roleId === null;
  const label = isFree ? 'LIBRE' : labelOverride ?? assignment.code;
  return (
    <Box
      minH="48px"
      borderWidth="1px"
      borderColor="blackAlpha.100"
      display="flex"
      alignItems="center"
      justifyContent="center"
      cursor={onClick ? 'pointer' : 'default'}
      bg={isFree ? 'white' : `${role?.colorHex ?? '#EDF2F7'}22`}
      onClick={onClick}
    >
      <Badge
        colorScheme={isFree ? 'gray' : 'blue'}
        px={2.5}
        py={0.5}
        borderRadius="md"
        fontSize="xs"
        fontWeight="700"
      >
        {label}
      </Badge>
    </Box>
  );
}
