function generate_web_references()
% Execute the pinned, unmodified MATLAB scientific routines headlessly.
% Plotting and large workspace saves from the examples are omitted; numerical
% inputs and solver defaults are retained. P=10 is the professor's selected
% subset of the 2D script. The quick 3D case is explicitly a reduced web demo.
root = fileparts(fileparts(mfilename('fullpath')));
addpath(fullfile(root,'matlab','reference'));
out = fullfile(root,'matlab','generated');
if ~exist(out,'dir'), mkdir(out); end
set(0,'DefaultFigureVisible','off');
fprintf('MATLAB reference runtime: %s\n', version);

% Full 3D forward, then the quick 3D recovery, each using MATLAB's own legacy
% random stream. Export the actual truth rather than emulating randn in Python.
for quick = [false true]
    if quick, file='matlab3dQuickConfig.json'; tag='matlab3d_quick';
    else, file='matlab3dConfig.json'; tag='matlab3d_full'; end
    c=jsondecode(fileread(fullfile(root,'web','src','data',file)));
    domain=struct('x',linspace(c.minX,c.maxX,c.gridNx+1), ...
        'y',linspace(c.minY,c.maxY,c.gridNy+1),'z',linspace(c.minZ,c.maxZ,c.gridNz+1));
    wells=[[c.wells.x]' [c.wells.y]' [c.wells.z]'];
    ids={c.wells.id}; rows=[];
    for t=1:numel(c.tests)
        test=c.tests(t); pump=find(strcmp(ids,test.pumpingWellId));
        for k=1:numel(test.observationWellIds)
            obs=find(strcmp(ids,test.observationWellIds{k}));
            rows(end+1,:)=[2*pi/test.pumpingPeriod,pump,test.pumpingRate,obs]; %#ok<AGROW>
        end
    end
    bdrys=struct('types',ones(6,1),'vals',zeros(6,1),'leaks',1e-5*ones(6,1));
    [coords,~]=plaid_cellcenter_coord(domain);
    d=dimdist(coords(1,:),coords);
    corr=exp(-sqrt((d(:,:,1)/20).^2+(d(:,:,2)/20).^2+(d(:,:,3)/4).^2));
    randn('state',0); %#ok<RAND>
    relz=toepmat_vector_math(corr,'r',[],3,[c.gridNy c.gridNx c.gridNz]);
    truth=[-9.2+2*relz(:,1);-11.2+sqrt(.1)*relz(:,2)];
    experiment=OHT_create_inputs(wells,rows,domain);
    h=@(s)OHT_run_distribKSs(s,domain,bdrys,experiment,1);
    fprintf('Computing %s forward: %d cells, %d responses\n',tag,numel(truth)/2,size(rows,1));
    observed=h(truth); estimated=[]; predicted=observed; objective=[]; coverage=[];
    if quick
        n=c.gridNx*c.gridNy*c.gridNz;
        prior=exp(-sqrt((d(:,:,1)/15).^2+(d(:,:,2)/15).^2+(d(:,:,3)/5).^2));
        Q=@(v)covar_product_K_Ss(4*prior,.1*prior,v,c.gridNx,c.gridNy,c.gridNz);
        H=@(s)OHT_run_distribKSs(s,domain,bdrys,experiment,3);
        X=[ones(n,1),zeros(n,1);zeros(n,1),ones(n,1)];
        initial=[-9*ones(n,1);-11*ones(n,1)];
        [estimated,beta,Hbest,objective]=ql_geostat_inv(observed,initial,[-9;-11],X,1e-8*eye(numel(observed)),Q,h,H);
        predicted=h(estimated);
        coverage=log10(sqrt(sum(Hbest.^2,1))+1e-30)';
    end
    matlab_version=version; %#ok<NASGU>
    save(fullfile(out,[tag '.mat']),'truth','observed','estimated','predicted','objective','coverage','rows','matlab_version','-v7');
    fprintf('Saved %s\n',tag);
end

% Professor's P=10 checkerboard: original 50x50 mesh and 36 pairs.
domain=struct('x',-50:2:50,'y',-50:2:50,'z',[0 1]);
wells=[-20 -20;-20 0;-20 20;0 -20;0 0;0 20;20 -20;20 0;20 20];
rows=[];
for j=1:9, for k=j+1:9, rows(end+1,:)=[2*pi/10,j,.01*pi/10,k]; end, end %#ok<AGROW>
bdrys=struct('types',[1;1;1;1;0;0],'vals',zeros(6,1),'leaks',1e-5*ones(6,1));
[coords,cgrid]=plaid_cellcenter_coord(domain); n=size(coords,1);
pattern=sign(sin(pi*cgrid{1}/10)).*sign(sin(pi*cgrid{2}/10));
truth=[reshape(-9.2+pattern,n,1);reshape(-11.2+.05*pattern,n,1)];
experiment=OHT_create_inputs(wells,rows,domain);
h=@(s)OHT_run_distribKSs(s,domain,bdrys,experiment,1);
H=@(s)OHT_run_distribKSs(s,domain,bdrys,experiment,3);
d=dimdist(coords(1,:),coords); prior=exp(-sqrt((d(:,:,1)/15).^2+(d(:,:,2)/15).^2));
Q=@(v)covar_product_K_Ss(4*prior,.1*prior,v,50,50);
observed=h(truth); X=[ones(n,1),zeros(n,1);zeros(n,1),ones(n,1)];
fprintf('Computing P=10 inversion\n');
[estimated,beta,Hbest,objective]=ql_geostat_inv(observed,[-9*ones(n,1);-11*ones(n,1)],[-9;-11],X,1e-8*eye(numel(observed)),Q,h,H);
predicted=h(estimated); coverage=log10(sqrt(sum(Hbest.^2,1))+1e-30)';
save(fullfile(out,'p10_checkerboard.mat'),'truth','observed','estimated','predicted','objective','coverage','rows','matlab_version','-v7');
clear Hbest;

% Black-Kipp uses a negative physical pump rate, then negates heads to plot
% drawdown. The web's positive-amplitude convention must match synth_data,
% not the intermediate signed physical head vector.
domain=equigrid_setup([-300 300 300],[-300 300 300]);
wells=[0 0;0 30;60 0;0 -90;-120 0]; rows=[];
for P=logspace(1,4,20), for obs=2:5, rows(end+1,:)=[2*pi/P,1,-.001,obs]; end, end %#ok<AGROW>
experiment=OHT_create_inputs(wells,rows,domain); n=300*300;
truth=[log(3e-4)*ones(n,1);log(1e-5)*ones(n,1)];
fprintf('Computing original Black-Kipp 300x300, 20 periods\n');
physical_heads=OHT_run_distribKSs(truth,domain,bdrys,experiment,1);
predicted=-physical_heads; % Drawdown convention used by original synth_data.
N=size(rows,1); analytical=zeros(N,1);
for k=1:N
    radius=norm(wells(rows(k,2),:)-wells(rows(k,4),:));
    u=sqrt(rows(k,1)*1e-5*radius^2/(2*3e-4));
    analytical(k)=.001/(2*pi*3e-4)*besselk(0,u+1i*u);
end
save(fullfile(out,'black_kipp.mat'),'predicted','physical_heads','analytical','rows','matlab_version','-v7');
fprintf('ALL MATLAB REFERENCES COMPLETE\n');
end
