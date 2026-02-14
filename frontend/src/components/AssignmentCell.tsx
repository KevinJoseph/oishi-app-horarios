import { Badge, Box } from '@chakra-ui/react';
import type { Assignment, Role } from '../types';

type Props = {
  assignment: Assignment;
  role?: Role;
  onClick?: () => void;
};

export function AssignmentCell({ assignment, role, onClick }: Props): JSX.Element {
  const isFree = assignment.roleId === null;
  return (
    <Box
      minH="48px"
      borderWidth="1px"
      borderColor="gray.200"
      display="flex"
      alignItems="center"
      justifyContent="center"
      cursor={onClick ? 'pointer' : 'default'}
      bg={isFree ? 'white' : `${role?.colorHex ?? '#EDF2F7'}33`}
      onClick={onClick}
    >
      <Badge colorScheme={isFree ? 'gray' : 'blue'}>{assignment.code}</Badge>
    </Box>
  );
}
