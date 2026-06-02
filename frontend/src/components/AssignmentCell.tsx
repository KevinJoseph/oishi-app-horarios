import { Badge, Box, Tooltip } from '@chakra-ui/react';
import { useState } from 'react';
import type { Assignment, Role } from '../types';
import { isBreakAssignment } from '../utils/assignments';

type Props = {
  assignment: Assignment;
  role?: Role;
  labelOverride?: string;
  onClick?: () => void;
  onDragFillStart?: () => void;
  onCellMouseEnter?: () => void;
  isDragHighlight?: boolean;
};

export function AssignmentCell({
  assignment,
  role,
  labelOverride,
  onClick,
  onDragFillStart,
  onCellMouseEnter,
  isDragHighlight = false
}: Props): JSX.Element {
  const [hover, setHover] = useState(false);
  const isBreak = isBreakAssignment(assignment);
  const isFree = assignment.roleId === null && !isBreak;
  const isOvertime = Boolean(assignment.overtime);
  const label = labelOverride ?? (isBreak ? 'Break' : isFree ? 'SIN ASIGNAR' : assignment.code);
  const baseBg = isOvertime
    ? '#9F7AEA22'
    : isBreak
      ? 'gray.100'
      : isFree
        ? 'white'
        : `${role?.colorHex ?? '#EDF2F7'}22`;
  return (
    <Box
      position="relative"
      minH="48px"
      borderWidth="1px"
      borderColor={isDragHighlight ? 'blue.400' : 'blackAlpha.100'}
      display="flex"
      alignItems="center"
      justifyContent="center"
      cursor={onClick ? 'pointer' : 'default'}
      bg={isDragHighlight ? 'blue.50' : baseBg}
      onClick={onClick}
      onMouseEnter={() => {
        setHover(true);
        onCellMouseEnter?.();
      }}
      onMouseLeave={() => setHover(false)}
    >
      <Badge
        colorScheme={isBreak ? 'gray' : isFree ? 'gray' : 'blue'}
        px={2.5}
        py={0.5}
        borderRadius="md"
        fontSize="xs"
        fontWeight="700"
      >
        {label}
      </Badge>
      {isOvertime ? (
        <Tooltip label="Hora extra (fuera del turno)" hasArrow>
          <Badge
            position="absolute"
            top="2px"
            left="2px"
            colorScheme="purple"
            fontSize="0.6rem"
            px={1}
            borderRadius="sm"
          >
            HE
          </Badge>
        </Tooltip>
      ) : null}
      {onDragFillStart && hover ? (
        <Tooltip label="Arrastra hacia abajo para rellenar" hasArrow openDelay={400}>
          <Box
            position="absolute"
            right="3px"
            bottom="3px"
            w="16px"
            h="16px"
            bg="blue.500"
            borderRadius="3px"
            cursor="ns-resize"
            border="2px solid white"
            boxShadow="0 0 0 1px rgba(0,0,0,0.15)"
            _hover={{ bg: 'blue.600' }}
            onMouseDown={(event) => {
              event.stopPropagation();
              event.preventDefault();
              onDragFillStart();
            }}
            onClick={(event) => event.stopPropagation()}
          />
        </Tooltip>
      ) : null}
    </Box>
  );
}
