import {
  Badge,
  Box,
  Button,
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
  Flex,
  Heading,
  Text
} from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import type { Role } from '../types';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  roles: Role[];
  canManage: boolean;
};

export function LegendDrawer({ isOpen, onClose, roles, canManage }: Props): JSX.Element {
  const navigate = useNavigate();
  return (
    <Drawer isOpen={isOpen} placement="right" onClose={onClose} size="sm">
      <DrawerOverlay />
      <DrawerContent>
        <DrawerCloseButton />
        <DrawerHeader>Leyenda de Zonas</DrawerHeader>
        <DrawerBody>
          <Flex direction="column" gap={4}>
            {roles.map((role) => (
              <Box key={role.id} borderWidth="1px" rounded="md" p={3}>
                <Flex align="center" gap={2} mb={2}>
                  <Box w={3} h={3} rounded="full" bg={role.colorHex} />
                  <Heading size="sm">{role.name}</Heading>
                </Flex>
                <Text fontSize="xs" color="gray.600" mb={2}>
                  Códigos válidos
                </Text>
                <Flex gap={2} wrap="wrap">
                  {role.validCodes.map((code) => (
                    <Badge key={code} colorScheme="gray" rounded="md" px={2}>
                      {code}
                    </Badge>
                  ))}
                </Flex>
              </Box>
            ))}
            <Button onClick={() => navigate('/roles')} isDisabled={!canManage}>
              Administrar Leyenda
            </Button>
          </Flex>
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}
