function matlab_scaling_benchmark()
%MATLAB_SCALING_BENCHMARK Run one parameterized P=10 inversion scaling case.
%
% OHT_GRID_CELLS supplies the equal x/y cell count. OHT_SCALING_OUTPUT is
% the JSON output path. A Python orchestrator launches each size in a fresh
% MATLAB process and externally samples peak process-tree resident memory.

repo_dir = fileparts(fileparts(mfilename('fullpath')));
addpath(repo_dir);
grid_cells = str2double(getenv('OHT_GRID_CELLS'));
output_path = getenv('OHT_SCALING_OUTPUT');
if ~isfinite(grid_cells) || grid_cells < 2 || grid_cells ~= floor(grid_cells)
    error('OHT_GRID_CELLS must be an integer of at least 2.');
end
if isempty(output_path)
    error('OHT_SCALING_OUTPUT must name the output JSON file.');
end

warning('off','all');
[case_data,setup_timing] = measure_call(@() build_case(grid_cells));
[data,synthetic_timing] = measure_call(@() OHT_run_distribKSs(...
    case_data.params_true,case_data.domain,case_data.bdrys,case_data.experiment,1));
[initial_prediction,initial_forward_timing] = measure_call(@() OHT_run_distribKSs(...
    case_data.params_init,case_data.domain,case_data.bdrys,case_data.experiment,1));
[sensitivity,jacobian_timing] = measure_call(@() OHT_run_distribKSs(...
    case_data.params_init,case_data.domain,case_data.bdrys,case_data.experiment,3));

linearized_data = data-initial_prediction+sensitivity*case_data.params_init;
[inverse_result,inverse_timing] = measure_call(@() run_linear_inverse(...
    linearized_data,case_data.X,case_data.R,case_data.Qproduct,sensitivity));

report.language = 'matlab';
report.grid_cells_per_axis = grid_cells;
report.spatial_cells = case_data.num_cells;
report.unknown_parameters = numel(case_data.params_init);
report.observations = numel(data);
report.jacobian_shape = size(sensitivity);
sensitivity_info = whos('sensitivity');
report.jacobian_storage_mib = sensitivity_info.bytes/2^20;
report.setup = setup_timing;
report.synthetic_forward = synthetic_timing;
report.initial_forward = initial_forward_timing;
report.jacobian = jacobian_timing;
report.linearized_inverse = inverse_timing;
report.checks.data_l2_norm = norm(data);
report.checks.jacobian_l2_norm = norm(sensitivity,'fro');
report.checks.estimate_l2_norm = norm(inverse_result.estimate);
report.checks.xi_l2_norm = norm(inverse_result.xi);
report.checks.beta = inverse_result.beta(:)';
report.checks.all_finite = all(isfinite(data)) && ...
    all(isfinite(sensitivity),'all') && all(isfinite(inverse_result.estimate));

json_text = jsonencode(report,PrettyPrint=true);
output_dir = fileparts(output_path);
if ~exist(output_dir,'dir')
    mkdir(output_dir);
end
file_id = fopen(output_path,'w');
if file_id < 0
    error('Unable to open benchmark output: %s',output_path);
end
cleanup = onCleanup(@() fclose(file_id));
fprintf(file_id,'%s',json_text);
disp(json_text);
warning('on','all');
end


function case_data = build_case(grid_cells)
domain.x = linspace(-50,50,grid_cells+1);
domain.y = linspace(-50,50,grid_cells+1);
domain.z = [0 1];
bdrys.types = [1;1;1;1;0;0];
bdrys.vals = zeros(6,1);
bdrys.leaks = 1e-5*ones(6,1);

well_locs = [-20 -20; -20 0; -20 20; 0 -20; 0 0; 0 20; 20 -20; 20 0; 20 20];
period = 10;
volume = 0.01;
test_list = [];
for pump = 1:size(well_locs,1)
    for observation = (pump+1):size(well_locs,1)
        test_list = [test_list; (2*pi)/period pump volume*pi/period observation]; %#ok<AGROW>
    end
end
experiment = OHT_create_inputs(well_locs,test_list,domain);
[coords,cgrid] = plaid_cellcenter_coord(domain);
num_cells = grid_cells^2;

x_wave = sin(pi*cgrid{1}/10);
y_wave = sin(pi*cgrid{2}/10);
% Make mathematical zero crossings independent of floating-point rounding.
x_wave(abs(x_wave) < 1e-12) = 0;
y_wave(abs(y_wave) < 1e-12) = 0;
checkerboard = sign(x_wave).*sign(y_wave);
params_true = [reshape(-9.2+checkerboard,num_cells,1); ...
    reshape(-11.2+0.05*checkerboard,num_cells,1)];
params_init = [-9*ones(num_cells,1); -11*ones(num_cells,1)];
beta_init = [-9;-11];
X = [ones(num_cells,1) zeros(num_cells,1); ...
    zeros(num_cells,1) ones(num_cells,1)];
R = 1e-8*eye(2*size(test_list,1));

distance_row = dimdist(coords(1,:),coords);
correlation_row = exp(-sqrt((distance_row(:,:,1)./15).^2 + ...
    (distance_row(:,:,2)./15).^2));
QK_row = 4*correlation_row;
QSs_row = 0.1*correlation_row;
Qproduct = @(vector) covar_product_K_Ss(...
    QK_row,QSs_row,vector,grid_cells,grid_cells);

case_data.domain = domain;
case_data.bdrys = bdrys;
case_data.experiment = experiment;
case_data.params_true = params_true;
case_data.params_init = params_init;
case_data.beta_init = beta_init;
case_data.X = X;
case_data.R = R;
case_data.Qproduct = Qproduct;
case_data.num_cells = num_cells;
end


function result = run_linear_inverse(data,X,R,Q,H)
[result.estimate,result.xi,result.beta] = lin_geostat_inv(data,X,R,Q,H);
end


function [value,timing] = measure_call(function_handle)
wall_start = tic;
cpu_start = cputime;
value = function_handle();
timing.wall_seconds = toc(wall_start);
timing.cpu_seconds = cputime-cpu_start;
end
