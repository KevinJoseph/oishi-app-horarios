import { Alert, AlertIcon, Badge, Box, Button, Container, HStack, Heading, Spinner, Text, VStack, useToast } from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { FiDownload } from 'react-icons/fi';
import { useParams, useSearchParams } from 'react-router-dom';
import { EmployeeWeekGrid } from '../components/EmployeeWeekGrid';
import { API_BASE_URL } from '../api/http';
import { downloadEmployeeWeekPdf } from '../utils/pdf';
import type { BreakConfig, DayPlan, Employee, Role, TimeSlot, Week, WeekPlan } from '../types';

type PublicScheduleResponse = {
  employee: {
    id: string;
    name: string;
    code: string;
    identityDocument: string;
    companyAlias: string;
    companyName: string;
    areaId: string;
    restDay: number | null;
  };
  weekStartDateISO: string;
  weekLabel: string | null;
  days: DayPlan[];
  restDayOverrides: number[] | null;
  timeSlots: TimeSlot[];
  breakConfig: BreakConfig;
  roles: Role[];
};

export function PublicEmployeeSchedulePage(): JSX.Element {
  const { employeeId } = useParams<{ employeeId: string }>();
  const [searchParams] = useSearchParams();
  const weekStart = searchParams.get('weekStart');
  const toast = useToast();

  const [data, setData] = useState<PublicScheduleResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleDownloadPdf = (): void => {
    if (!data) return;
    try {
      const employee = {
        id: data.employee.id,
        name: data.employee.name,
        code: data.employee.code,
        identityDocument: data.employee.identityDocument,
        companyAlias: data.employee.companyAlias,
        companyName: data.employee.companyName,
        active: true,
        restDay: data.employee.restDay ?? undefined,
        areaId: data.employee.areaId
      } as Employee;
      const week: Week = {
        id: data.weekStartDateISO,
        label: data.weekLabel ?? `Semana del ${data.weekStartDateISO}`,
        startDateISO: data.weekStartDateISO
      };
      const weekPlan: WeekPlan = {
        weekId: data.weekStartDateISO,
        days: data.days,
        ...(data.restDayOverrides ? { restDayOverrides: { [data.employee.id]: data.restDayOverrides } } : {})
      };
      downloadEmployeeWeekPdf({
        employee,
        roles: data.roles,
        timeSlots: data.timeSlots,
        breakConfig: data.breakConfig,
        week,
        weekPlan,
        isValidated: false,
        validatedByName: null
      });
    } catch {
      toast({ status: 'error', title: 'No se pudo generar el PDF.' });
    }
  };

  useEffect(() => {
    if (!employeeId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    const qs = weekStart ? `?weekStart=${encodeURIComponent(weekStart)}` : '';
    fetch(`${API_BASE_URL}/public/employee-schedule/${encodeURIComponent(employeeId)}${qs}`)
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text();
          let message = 'No se pudo cargar la planificación.';
          try {
            const parsed = JSON.parse(text) as { error?: string };
            if (parsed?.error) message = parsed.error;
          } catch {
            // ignore
          }
          throw new Error(message);
        }
        return (await res.json()) as PublicScheduleResponse;
      })
      .then((payload) => {
        if (cancelled) return;
        setData(payload);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Error inesperado.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [employeeId, weekStart]);

  return (
    <Box bg="gray.50" minH="100vh" py={6}>
      <Container maxW="6xl">
        <VStack align="stretch" spacing={5}>
          <Heading size="lg">Planificación semanal</Heading>

          {loading ? (
            <HStack>
              <Spinner />
              <Text>Cargando planificación...</Text>
            </HStack>
          ) : error ? (
            <Alert status="error" rounded="md">
              <AlertIcon />
              {error}
            </Alert>
          ) : data ? (
            <>
              <Box bg="white" p={4} rounded="md" borderWidth="1px">
                <Heading size="md" mb={2}>
                  {data.employee.name}
                </Heading>
                <HStack spacing={6} flexWrap="wrap" fontSize="sm" color="gray.700">
                  {data.employee.code ? (
                    <Text>
                      <b>Código:</b> {data.employee.code}
                    </Text>
                  ) : null}
                  {data.employee.companyName || data.employee.companyAlias ? (
                    <Text>
                      <b>Empresa:</b> {data.employee.companyName || data.employee.companyAlias}
                    </Text>
                  ) : null}
                  {data.employee.identityDocument ? (
                    <Text>
                      <b>Identificador:</b> {data.employee.identityDocument}
                    </Text>
                  ) : null}
                  <Badge colorScheme="blue">
                    Semana del {data.weekStartDateISO}
                    {data.weekLabel ? ` · ${data.weekLabel}` : ''}
                  </Badge>
                </HStack>
                <Box mt={3}>
                  <Button
                    leftIcon={<FiDownload />}
                    colorScheme="brand"
                    size="sm"
                    onClick={handleDownloadPdf}
                    isDisabled={data.days.length === 0}
                  >
                    Descargar PDF
                  </Button>
                </Box>
              </Box>

              {data.days.length === 0 ? (
                <Alert status="info" rounded="md">
                  <AlertIcon />
                  No hay planificación publicada para esta semana.
                </Alert>
              ) : (
                <EmployeeWeekGrid
                  employee={
                    {
                      id: data.employee.id,
                      name: data.employee.name,
                      active: true,
                      restDay: data.employee.restDay ?? undefined,
                      areaId: data.employee.areaId
                    } as Employee
                  }
                  days={data.days}
                  roles={data.roles}
                  timeSlots={data.timeSlots}
                  breakConfig={data.breakConfig}
                  restDayOverrides={data.restDayOverrides ?? undefined}
                  maxTableHeight="70vh"
                />
              )}
            </>
          ) : null}
        </VStack>
      </Container>
    </Box>
  );
}
